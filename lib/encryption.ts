import crypto from 'crypto';

/**
 * Get encryption key from environment
 * TODO: Implement key rotation mechanism
 */
function getEncryptionKey(): string {
  const key = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || 'default-dev-secret-key-change-in-production';
  return key;
}

/**
 * Encrypt a secret string using AES-256-GCM
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-gcm', key);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a secret string using AES-256-GCM
 */
export function decryptSecret(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
export function isEncrypted(data: string): boolean {
  return data.includes(':') && data.split(':').length === 3;
}
