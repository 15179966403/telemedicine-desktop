// 加密工具

use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, OsRng, AeadCore};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::{rand_core::RngCore, SaltString}};
use anyhow::Result;
use base64::{Engine as _, engine::general_purpose};

pub struct CryptoService {
    cipher: Aes256Gcm,
}

impl CryptoService {
    pub fn new() -> Self {
        // 在实际应用中，密钥应该从环境变量或配置文件中读取
        let key_bytes = b"an example very very secret key."; // 32 bytes for AES-256
        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let cipher = Aes256Gcm::new(key);

        Self { cipher }
    }

    pub fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = self.cipher.encrypt(&nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // 将 nonce 和密文组合
        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    pub fn decrypt_data(&self, encrypted_data: &[u8]) -> Result<Vec<u8>> {
        if encrypted_data.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = self.cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        Ok(plaintext)
    }

    pub fn encrypt_string(&self, data: &str) -> Result<String> {
        let encrypted = self.encrypt_data(data.as_bytes())?;
        Ok(general_purpose::STANDARD.encode(encrypted))
    }

    pub fn decrypt_string(&self, encrypted_data: &str) -> Result<String> {
        let decoded = general_purpose::STANDARD.decode(encrypted_data)?;
        let decrypted = self.decrypt_data(&decoded)?;
        Ok(String::from_utf8(decrypted)?)
    }

    pub fn hash_password(&self, password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Password hashing failed: {}", e))?;

        Ok(password_hash.to_string())
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| anyhow::anyhow!("Invalid password hash: {}", e))?;

        let argon2 = Argon2::default();
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    pub fn generate_random_token(&self, length: usize) -> String {
        let mut bytes = vec![0u8; length];
        OsRng.fill_bytes(&mut bytes);
        general_purpose::STANDARD.encode(bytes)
    }
}

// 保持向后兼容的函数
pub fn hash_password(password: &str) -> Result<String> {
    let crypto = CryptoService::new();
    crypto.hash_password(password)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let crypto = CryptoService::new();
    crypto.verify_password(password, hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_string() {
        let crypto = CryptoService::new();
        let original = "Hello, World!";

        let encrypted = crypto.encrypt_string(original).unwrap();
        let decrypted = crypto.decrypt_string(&encrypted).unwrap();

        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_password_hash_verify() {
        let crypto = CryptoService::new();
        let password = "test_password_123";

        let hash = crypto.hash_password(password).unwrap();
        assert!(crypto.verify_password(password, &hash).unwrap());
        assert!(!crypto.verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_generate_random_token() {
        let crypto = CryptoService::new();
        let token1 = crypto.generate_random_token(32);
        let token2 = crypto.generate_random_token(32);

        assert_ne!(token1, token2);
        assert!(!token1.is_empty());
        assert!(!token2.is_empty());
    }
}