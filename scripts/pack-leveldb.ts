// Compile one compendium pack from its JSON source into the LevelDB the manifest registers.
//
// `fvtt package pack` opens the *destination* to clear it before writing, so a destination left in a
// bad state (an uncompacted write-ahead log from a Foundry session) throws `LEVEL_ITERATOR_NOT_OPEN` —
// indistinguishable from a real Foundry lock. So we never pack into the live dir: compile into a fresh
// temp dir (always clean) and swap it in only once complete. If the swap can't happen because Foundry
// holds the pack open, the existing build is left intact and we return false.
import { rmSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export function packCompendium(name: string, inDir: string, packsDir: string): boolean {
  const staging = join(packsDir, '.pack-staging'); // gitignored (packs/* except _source/)
  const tmpOut = join(staging, name);
  const dest = join(packsDir, name);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  try {
    execFileSync('fvtt', ['package', 'pack', name, '--in', inDir, '--out', staging], {
      stdio: 'inherit',
      cwd: dirname(packsDir),
    });
    rmSync(dest, { recursive: true, force: true }); // throws on Windows if Foundry holds it open
    renameSync(tmpOut, dest);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
