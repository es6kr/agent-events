import * as fs from "fs";

// Converts a Windows drive-letter path to the POSIX form the invoked `bash`
// expects. Three mount conventions exist: WSL (/mnt/<drive>), true Cygwin
// (/cygdrive/<drive>), and Git-Bash/MSYS2 (/<drive> directly). `bash
// --version`'s build-target string is not a reliable discriminator — on at
// least one real machine it reports "x86_64-pc-cygwin" while the actual
// runtime is MSYS2 (uname reports MINGW64/Msys, /c works, /cygdrive does
// not) — so probe the actual mount points on disk instead (cheap
// fs.existsSync, no subprocess spawn), checking the more specific
// conventions (WSL, Cygwin) before falling back to the Git-Bash/MSYS2 form.
// On Linux/macOS CI runners the path is already POSIX, so the drive-letter
// regex never matches and this is a no-op.
export function toPosixPath(p: string): string {
  let posix = p.replace(/\\/g, "/");
  const driveMatch = /^([a-zA-Z]):/.exec(posix);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = posix.substring(2);
    if (fs.existsSync(`/mnt/${drive}`)) {
      posix = `/mnt/${drive}${rest}`;
    } else if (fs.existsSync(`/cygdrive/${drive}`)) {
      posix = `/cygdrive/${drive}${rest}`;
    } else {
      posix = `/${drive}${rest}`;
    }
  }
  return posix;
}
