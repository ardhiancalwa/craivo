import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

describe('Backup & Disaster Recovery Drill Verification Suite', () => {
  const secretKey = 'test_backup_aes256_encryption_key_minimum_32_characters'
  const aesKey = crypto.createHash('sha256').update(secretKey).digest()

  it('correctly encrypts and decrypts backup payload using AES-256-GCM', () => {
    const originalPayload = {
      manifest: {
        backupId: 'cravio-backup-test-01',
        totalRecords: 100,
      },
      data: {
        tables: [{ id: 'tbl-1', tableNumber: '01' }],
        orders: [{ id: 'ord-1', totalAmount: 50000 }],
      },
    }

    const jsonString = JSON.stringify(originalPayload)
    const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'))

    // Encrypt
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
    const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()])
    const authTag = cipher.getAuthTag()

    const archive = Buffer.concat([iv, authTag, ciphertext])

    // Decrypt
    const decIv = archive.subarray(0, 16)
    const decTag = archive.subarray(16, 32)
    const decCiphertext = archive.subarray(32)

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, decIv)
    decipher.setAuthTag(decTag)

    const decryptedCompressed = Buffer.concat([
      decipher.update(decCiphertext),
      decipher.final(),
    ])
    const restoredJson = zlib.gunzipSync(decryptedCompressed).toString('utf-8')
    const restoredObj = JSON.parse(restoredJson)

    expect(restoredObj.manifest.backupId).toBe('cravio-backup-test-01')
    expect(restoredObj.data.tables[0].tableNumber).toBe('01')
    expect(restoredObj.data.orders[0].totalAmount).toBe(50000)
  })

  it('detects tampering or corruption in encrypted archive via AuthTag failure', () => {
    const payload = Buffer.from('important-cravio-database-records')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Tamper single byte in ciphertext
    const firstByte = ciphertext[0] ?? 0
    ciphertext[0] = firstByte ^ 0xff

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv)
    decipher.setAuthTag(authTag)

    expect(() => {
      Buffer.concat([decipher.update(ciphertext), decipher.final()])
    }).toThrow()
  })

  it('detects SHA-256 checksum mismatch on corrupted file before decryption', () => {
    const dummyFile = Buffer.from('cravio-backup-content-binary')
    const validChecksum = crypto.createHash('sha256').update(dummyFile).digest('hex')

    const corruptedFile = Buffer.from('cravio-backup-content-tampered')
    const corruptedChecksum = crypto.createHash('sha256').update(corruptedFile).digest('hex')

    expect(corruptedChecksum).not.toBe(validChecksum)
  })
})

