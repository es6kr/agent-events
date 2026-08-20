import * as fs from "fs";

// Converts a Windows drive-letter path to the POSIX form the invoked `bash`
// expects. WSL's bash mounts drives at /mnt/<drive>; Git-Bash/Cygwin mounts
// them at /<drive> directly. Distinguish by checking for the WSL mount point
// (cheap fs.existsSync, no subprocess spawn) rather than assuming one flavor.
// On Linux/macOS CI runners the path is already POSIX, so the drive-letter
// regex never matches and this is a no-op.
export function toPosixPath(p: string): string {
  let posix = p.replace(/\\/g, "/");
  const driveMatch = /^([a-zA-Z]):/.exec(posix);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = posix.substring(2);
    const isWsl = fs.existsSync(`/mnt/${drive}`);
    posix = isWsl ? `/mnt/${drive}${rest}` : `/${drive}${rest}`;
  }
  return posix;
}
