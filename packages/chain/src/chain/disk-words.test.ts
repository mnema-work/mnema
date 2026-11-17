import { describe, expect, it } from 'vitest';
import { recordedNotSigned, signatureNotConfirmed, WriteNotLandedError } from './disk-words.js';

const ENOSPC = Object.assign(new Error('ENOSPC: no space left on device, write'), {
  code: 'ENOSPC',
});

describe('what the writer says when the disk fails it', () => {
  it('says a fact is recorded and not yet signed, with the errno the disk gave', () => {
    expect(recordedNotSigned(ENOSPC)).toBe(
      'mnema: recorded, not yet signed: the next write signs it. The disk reported: ENOSPC: no space left on device, write.',
    );
  });

  it('says a signature the disk did not confirm is in the file', () => {
    expect(signatureNotConfirmed(new Error('EIO: i/o error, fsync'))).toContain(
      'recorded and signed, but the disk did not confirm',
    );
  });

  it('refuses by code, naming the errno and that nothing was written', () => {
    const refusal = new WriteNotLandedError(ENOSPC);
    expect(refusal.code).toBe('WRITE_NOT_LANDED');
    expect(refusal.message).toContain('ENOSPC: no space left on device, write');
    expect(refusal.message).toContain('nothing was written');
  });

  it('words a thrown value that is not an error as the text it is', () => {
    expect(recordedNotSigned('disk gone')).toContain('The disk reported: disk gone.');
  });
});
