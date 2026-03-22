# ⚡ RX1N — The X1 Air Dropper

> Batch airdrop SPL & Token-2022 tokens to all holders of any X1 token. 🚀

RX1N is a trustless, wallet-connected airdrop tool built for the X1 blockchain. Point it at any token mint, fetch all holders automatically, select your payload and fire — all from your browser, no backend required. Built with ❤️ by [tony](https://t.me/ironmanmk2).

🌐 [rx1n.xyz](https://www.rx1n.xyz) · 🔥 [x1nerator.xyz](https://x1nerator.xyz) · ✈️ [t.me/rx1ndrop](https://t.me/rx1ndrop)

---

## 🛠️ How To Use

1. 🔌 **Connect your wallet** — Backpack or X1 Wallet
2. 🔢 **Enter max recipients** — sets a hard cap and shows you the full cost upfront before anything happens
3. 🔍 **Fetch holders** — paste the mint address of the token whose holders you want to target. RX1N scans the X1 ledger, sorts holders from highest balance to lowest, and caps the list at your number
4. 🪙 **Distribute token select** — choose the token from your wallet you want to airdrop (Fungible or NFT) and enter the amount per recipient
5. 🚀 **Hit MAKE\_IT\_RX1N** — batches of 7 are processed and confirmed on-chain one by one

> 💡 If a batch fails mid-drop your progress is saved. Hit **KEEP\_RX1NING** to resume exactly where you left off.

> 📥 When the drop completes, hit **DWNLD\_RCPT** to download a full receipt JSON with every transaction hash, recipient address, and exact fees paid per batch.

---

## 💸 Fees

All fees are paid in **XNT**.

| Fee | Amount |
|-----|--------|
| 🏦 Dev fee | 0.001 XNT per batch |
| 🌐 Network fee | Exact on-chain figure — varies per batch |
| 🔑 ATA rent | Exact on-chain figure — only charged when a new token account is opened for a recipient |

> ℹ️ Recipients who already hold the token won't incur ATA rent — only first-time holders do. Every fee in the receipt is the exact amount pulled from the confirmed transaction, not an estimate.

---

## 📄 Receipt Format

After every drop you can download a `RX1NDROP REPORT` JSON file containing:

- ✅ Transaction hash + explorer link for every batch
- ✅ Every recipient wallet address per batch
- ✅ Exact network fee, dev fee, and ATA rent per batch
- ✅ Grand totals at the bottom

---

## ⚠️ Tips

- ✅ **Enable auto-sign** in your wallet to avoid manually approving every batch
- ✅ **Disable auto-lock** to prevent your wallet idling and dropping the session mid-airdrop
- ✅ Holders are sorted **highest balance first** — the top holders always get the drop
- ✅ PDA addresses (program accounts) are automatically skipped — you are never charged for them
