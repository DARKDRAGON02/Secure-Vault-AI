export const bufferToBase64 = (buf: ArrayBuffer): string => 
  btoa(String.fromCharCode(...new Uint8Array(buf)));

export const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const getNewKey = (): Promise<CryptoKey> => 
  window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

export const encryptData = async (text: string, key: CryptoKey) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ciphertext, iv };
};

export const decryptData = async (encryptedData: ArrayBuffer, key: CryptoKey, iv: ArrayBuffer) => {
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
  return new TextDecoder().decode(decrypted);
};