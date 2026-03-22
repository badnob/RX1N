// src/lib/airdropLogic.ts
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { DEV_WALLET, DEV_FEE_PER_BATCH_XNT } from './constants';

export interface BatchResult {
  signature: string;
  recipientsSent: string[];   // addresses that actually received tokens
  recipientsSkipped: string[]; // off-curve addresses that were skipped
  newAtasCreated: number;      // number of ATAs opened (each costs rent)
  networkFeeXNT: number;       // exact fee paid to validators in XNT
  devFeeXNT: number;           // exact dev fee paid in XNT
  ataRentXNT: number;          // exact ATA rent deposited in XNT
  totalXNTSpent: number;       // networkFee + devFee + ataRent
  tokensTransferred: number;   // total token units sent in this batch
}

/**
 * Sends a single pre-chunked batch of recipients in one transaction.
 * Returns a BatchResult with exact on-chain figures after confirmation.
 *
 * NOTE: The caller (App.tsx) is responsible for chunking the full holder list
 * into slices of CHUNK_SIZE before calling this function.
 */
export async function executeBatchedAirdrop(
  connection: Connection,
  wallet: PublicKey,
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>,
  dropMint: string,
  decimals: number,
  dropAmount: string,
  chunk: string[],
  setStatus: (status: string) => void,
  batchLabel: string
): Promise<BatchResult | null> {
  const dropMintPubkey = new PublicKey(dropMint);
  const amountPerUser = BigInt(Math.floor(parseFloat(dropAmount) * Math.pow(10, decimals)));

  // Detect whether the mint belongs to standard SPL Token or Token-2022
  const mintInfo = await connection.getAccountInfo(dropMintPubkey);
  if (!mintInfo) throw new Error('Mint account not found on-chain');

  const programId = mintInfo.owner;
  const isStandard = programId.equals(TOKEN_PROGRAM_ID);
  const is2022 = programId.equals(TOKEN_2022_PROGRAM_ID);
  if (!isStandard && !is2022) throw new Error('Unknown token program ID');

  // Sender's associated token account
  const senderAta = getAssociatedTokenAddressSync(
    dropMintPubkey,
    wallet,
    false,
    programId
  );

  const tx = new Transaction();

  // Per-batch dev fee (XNT)
  tx.add(
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: DEV_WALLET,
      lamports: Math.round(DEV_FEE_PER_BATCH_XNT * LAMPORTS_PER_SOL),
    })
  );

  // Check which recipients already have an ATA
  setStatus(`Checking accounts for batch ${batchLabel}...`);
  const skipped: string[] = [];

  const ataChecks = await Promise.all(
    chunk.map(async (recipient) => {
      try {
        const recipientPubkey = new PublicKey(recipient);

        const recipientAta = getAssociatedTokenAddressSync(
          dropMintPubkey,
          recipientPubkey,
          false,
          programId
        );

        const ataInfo = await connection.getAccountInfo(recipientAta);
        return { recipientPubkey, recipientAta, ataExists: ataInfo !== null, address: recipient };
      } catch (e: any) {
        // Address is genuinely invalid or off-curve — skip it
        console.warn(`[airdrop] Skipping invalid address ${recipient}:`, e?.message ?? e);
        skipped.push(recipient);
        return null;
      }
    })
  );

  const validRecipients = ataChecks.filter((r): r is NonNullable<typeof r> => r !== null);

  if (validRecipients.length === 0) {
    setStatus(`Batch ${batchLabel} skipped — all recipients were invalid addresses.`);
    return null;
  }

  let newAtasCreated = 0;

  for (const { recipientPubkey, recipientAta, ataExists } of validRecipients) {
    if (!ataExists) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet,
          recipientAta,
          recipientPubkey,
          dropMintPubkey,
          programId
        )
      );
      newAtasCreated++;
    }

    tx.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        wallet,
        amountPerUser,
        [],
        programId
      )
    );
  }

  setStatus(`Sending batch ${batchLabel}...`);
  let signature: string;
  try {
    signature = await sendTransaction(tx, connection);
  } catch (err: any) {
    const msg = err?.message || err?.toString() || JSON.stringify(err);
    if (msg.includes('UserKeyring not found') || msg.includes('invariant violation')) {
      throw new Error('Wallet session expired. Unlock your wallet and click MAKE IT RX1N to resume.');
    }
    if (msg.includes('User rejected') || msg.includes('Transaction cancelled')) {
      throw new Error('Transaction rejected. Click MAKE IT RX1N to retry this batch.');
    }
    throw new Error(`Send failed: ${msg}`);
  }

  setStatus(`Confirming batch ${batchLabel}...`);
  try {
    await connection.confirmTransaction(signature, 'processed');
  } catch (err: any) {
    const msg = err?.message || err?.toString() || JSON.stringify(err);
    throw new Error(`Confirmation failed: ${msg}`);
  }

  // ── Fetch exact on-chain fees ──────────────────────────────────────────────
  // Pull the confirmed transaction to get the real fee paid to validators
  let networkFeeXNT = 0;
  let ataRentXNT = 0;

  try {
    // Retry a few times — the tx may not be immediately available
    let txDetails = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (txDetails) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (txDetails?.meta) {
      // Exact network fee in XNT
      networkFeeXNT = (txDetails.meta.fee ?? 0) / LAMPORTS_PER_SOL;

      // ATA rent = only accounts that had zero balance before (newly created accounts)
      // This excludes the dev fee transfer and existing accounts receiving tokens
      const pre = txDetails.meta.preBalances;
      const post = txDetails.meta.postBalances;
      let rentPaid = 0;
      for (let i = 1; i < post.length; i++) {
        if ((pre[i] ?? 0) === 0 && (post[i] ?? 0) > 0) {
          rentPaid += post[i] ?? 0;
        }
      }
      ataRentXNT = rentPaid / LAMPORTS_PER_SOL;
    }
  } catch (e) {
    console.warn('[airdrop] Could not fetch exact tx fees, using estimates', e);
    networkFeeXNT = 0.00003;
    ataRentXNT = newAtasCreated * 0.002039; // 0 if no new ATAs created
  }

  const devFeeXNT = DEV_FEE_PER_BATCH_XNT;
  const totalXNTSpent = networkFeeXNT + devFeeXNT + ataRentXNT;
  const tokensTransferred = parseFloat(dropAmount) * validRecipients.length;

  return {
    signature,
    recipientsSent: validRecipients.map((r) => r.address),
    recipientsSkipped: skipped,
    newAtasCreated,
    networkFeeXNT,
    devFeeXNT,
    ataRentXNT,
    totalXNTSpent,
    tokensTransferred,
  };
}
