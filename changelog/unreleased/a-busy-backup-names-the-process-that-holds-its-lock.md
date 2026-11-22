Changed

- **A backup that finds another run on the same destination says which process holds the lock and how to clear it.** The refusal after 30 seconds now names the process that holds `<cache>.lock` and adds that, if it is not a mnema backup that is still running, you delete that file and run again. A process that still answers is never overruled, so a pid reused by an unrelated process keeps the lock until the file is deleted. Nothing is changed by the refused run.
