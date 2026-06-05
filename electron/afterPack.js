const { execSync } = require('child_process');
const path = require('path');

// Strip resource forks, extended attributes, and ._* files before code signing
exports.default = async function(context) {
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`Cleaning app bundle: ${appPath}`);
  try {
    // Remove ._ resource fork files
    execSync(`find "${appPath}" -name "._*" -delete 2>/dev/null || true`, { stdio: 'inherit' });
    // dot_clean to merge/remove resource forks
    execSync(`dot_clean "${appPath}" 2>/dev/null || true`, { stdio: 'inherit' });
    // Remove ALL extended attributes including com.apple.provenance
    execSync(`find "${appPath}" -exec xattr -c {} + 2>/dev/null || true`, { stdio: 'inherit' });
    console.log('App bundle cleaned successfully');
  } catch (err) {
    console.warn('Warning during cleanup:', err.message);
  }
};
