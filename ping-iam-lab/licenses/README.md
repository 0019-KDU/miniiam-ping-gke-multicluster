# License Files Directory

Place your Ping Identity license files here:

- `PingDirectory.lic` - PingDirectory license
- `pingfederate.lic` - PingFederate license  
- `pingaccess.lic` - PingAccess license

## How to Obtain Licenses

### Option 1: Ping DevOps Program (Recommended for Lab/Dev)
1. Register at https://devops.pingidentity.com/get-started/devopsRegistration/
2. Set PING_IDENTITY_DEVOPS_USER and PING_IDENTITY_DEVOPS_KEY in your .env
3. The containers will automatically obtain evaluation licenses

### Option 2: Evaluation Licenses
1. Contact Ping Identity sales for evaluation licenses
2. Place the .lic files in this directory

### Option 3: Existing Licenses
If you have existing Ping Identity licenses, copy them here.

## Important
- NEVER commit license files to version control
- The .gitignore is configured to exclude *.lic files
