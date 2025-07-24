/* ──────────────────────────────────────────────────────────────────────────
   crypto.ts – WebCrypto helpers for dual‑wrapped E2EE
   Uses idb‑keyval for IndexedDB persistence
   ───────────────────────────────────────────────────────────────────────── */
import { get, set } from "idb-keyval"

const KEY_ID = "e2ee-keypair-v1"

/* ── Key‑pair helpers ────────────────────────────────────────────────────── */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  let kp = await get<CryptoKeyPair>(KEY_ID)
  if (!kp) {
    kp = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    )
    await set(KEY_ID, kp)
  }
  return kp
}

export async function exportPublicKey(): Promise<string> {
  const kp = await getOrCreateKeyPair()
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey)
  return btoa(String.fromCharCode(...new Uint8Array(spki)))
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "spki",
    buf,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt", "wrapKey"]
  )
}

/* ── Dual‑wrap encryption ───────────────────────────────────────────────── */
export async function encryptForBoth(
  plaintext: string,
  recipientPub: CryptoKey,
  senderPub: CryptoKey
) {
  // 1. fresh AES‑GCM key
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )

  // 2. encrypt plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  )

  // 3. wrap AES key twice
  const wrap = (k: CryptoKey) =>
    crypto.subtle.wrapKey("raw", aesKey, k, { name: "RSA-OAEP" })
  const [wrappedRecipient, wrappedSender] = await Promise.all([
    wrap(recipientPub),
    wrap(senderPub),
  ])

  // 4. split ciphertext & tag
  const encU8 = new Uint8Array(encBuf)
  const tag = encU8.slice(-16)
  const ct = encU8.slice(0, encU8.length - 16)
  const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8))

  return {
    ciphertext: b64(ct),
    encrypted_key: b64(new Uint8Array(wrappedRecipient)),
    encrypted_key_self: b64(new Uint8Array(wrappedSender)),
    iv: b64(iv),
    tag: b64(tag),
  }
}

/* ── Decrypt with whichever wrapped key belongs to me ───────────────────── */
export async function decryptWithKey(
  bundle: { ciphertext: string; iv: string; tag: string },
  encryptedKeyB64: string
): Promise<string> {
  const kp = await getOrCreateKeyPair()
  const b = (x: string) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0))

  const aesKey = await crypto.subtle.unwrapKey(
    "raw",
    b(encryptedKeyB64),
    kp.privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  )

  const cipherFull = new Uint8Array([...b(bundle.ciphertext), ...b(bundle.tag)])
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b(bundle.iv) },
    aesKey,
    cipherFull
  )
  return new TextDecoder().decode(plainBuf)
}

/* ── Convenience for register pages ─────────────────────────────────────── */
export async function generateKeyAndGetPublicB64() {
  await getOrCreateKeyPair()
  return exportPublicKey()
}
