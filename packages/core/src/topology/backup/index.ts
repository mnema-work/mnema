/**
 * The backup of a project's trees into a folder: the engine ({@link copyTree}), and where a
 * machine keeps which folder is which project's ({@link readBackupConfig}).
 */

export {
  type Assigned,
  assignDestination,
  BACKUP_CONFIG,
  BackupConfigError,
  backupConfigPath,
  destinationOf,
  readBackupConfig,
  whyNotADestination,
} from './config.js';
export {
  BACKUP_MANIFEST,
  BackupRefusedError,
  type BackupTree,
  type Copied,
  type CopyStanding,
  copyTree,
  type PlannedFile,
  planCopy,
  standingOfCopy,
} from './copy.js';
