import JSZip from 'jszip';
import { Dock } from './dock-engine';

export async function generatePackageZIP(dock: Dock): Promise<Blob> {
    const zip = new JSZip();

    const makePackageScript = `#!/bin/bash

# Name of the package.
NAME="${dock.payloadIdentifier}"

# Once installed the identifier is used as the filename for a receipt files in /var/db/receipts/.
IDENTIFIER="au.com.errorfreeit.dockmaster.\${NAME}"

# Package version.
VERSION="1.0"

# The User Template directory is applied to new user accounts. The dock plist placed in this directory will be copied into new accounts.
INSTALL_LOCATION="/System/Library/User Template/English.lproj/Library/Preferences/"

# Change into the same directory as this script.
cd "$(/usr/bin/dirname "$0")"

# Store the path containing this script.
SCRIPT_PATH="$(pwd)"

# Build the package.
/usr/bin/pkgbuild \\
    --root "\${SCRIPT_PATH}/payload/" \\
    --install-location "$INSTALL_LOCATION" \\
    --scripts "$SCRIPT_PATH/scripts/" \\
    --identifier "$IDENTIFIER" \\
    --version "$VERSION" \\
    "\${SCRIPT_PATH}/package/\${NAME}-\${VERSION}.pkg"`;

    const postInstallScript = `#!/bin/bash

# Apply dock to existing user accounts.
APPLY_DOCK_TO_EXISTING_USERS=true

### NOTHING BELOW THIS LINE NEEDS TO CHANGE ###

# A dock plist placed in the User Template directory is applied to new user accounts.
USER_TEMPLATE_DOCK_PLIST="/System/Library/User Template/English.lproj/Library/Preferences/com.apple.dock.plist"

# Currently logged in user.
CURRENTLY_LOGGED_IN_USER=$(/bin/ls -l /dev/console | /usr/bin/awk '{ print $3 }')

if [[ "$APPLY_DOCK_TO_EXISTING_USERS" == "true" ]]
then
    # Output local home directory path (/Users/username).
    for USER_HOME in /Users/*
    do
        # Extract account name (a.k.a. username) from home directory path.
        ACCOUNT_NAME=$(/usr/bin/basename "\${USER_HOME}")

        # If account name is not "Shared".
        if [[ "$ACCOUNT_NAME" != "Shared" ]]
        then
            USER_DOCK_PLIST="\${USER_HOME}/Library/Preferences/com.apple.dock.plist"

            # If the account already contains a dock plist.
            if [[ -f "$USER_DOCK_PLIST" ]]
            then
                echo "Removing existing user dock plist."
                /usr/bin/defaults delete "$USER_DOCK_PLIST"
           fi

            echo "Copying the latest dock plist into place."
            cp "$USER_TEMPLATE_DOCK_PLIST" "$USER_DOCK_PLIST"

            echo "Updating permissions to match user (\${ACCOUNT_NAME})."
            /usr/sbin/chown -R "$ACCOUNT_NAME" "$USER_DOCK_PLIST"

            # Reboot the dock if a user is currently logged in.
            if [[ "$CURRENTLY_LOGGED_IN_USER" == "$ACCOUNT_NAME" ]]
            then
                # Update cached dock plist.
                /usr/bin/sudo -u "$ACCOUNT_NAME" /usr/bin/defaults read "$USER_DOCK_PLIST"
                # Relaunch the dock process.
                /usr/bin/killall Dock
            fi
        fi
    done
fi`;

    zip.file('makepackage.command', makePackageScript);
    zip.file('payload/com.apple.dock.plist', dock.generatePlistXML());
    zip.file('scripts/postinstall', postInstallScript);

    // Create folders as well (JSZip handles this by paths, but we can be explicit)
    zip.folder('package');

    return await zip.generateAsync({ type: 'blob' });
}

export function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
