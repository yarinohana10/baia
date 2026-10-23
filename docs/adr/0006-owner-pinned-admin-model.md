# The Owner is pinned by environment; other Admins are granted by invitation

The Owner is the Account whose verified email equals `OWNER_EMAIL`. The variable is re-applied on every boot and on every verified sign-in (promotion only), so a deploy or restart can never demote the Owner or any Admin added from the admin screen, and the shop cannot be left without an Owner. Only the Owner can add or remove other Admins.

Adding an Admin who has no Account creates an Admin Invitation for their email. It takes effect only when that person registers and verifies the same address, so a typo or a stranger's email can never gain admin rights. Existing Accounts are promoted directly. No default or seeded admin exists in production; the first Owner simply registers `OWNER_EMAIL` on the live site.

Rejected: a seeded admin with a known password (a credential in the repo), and a CLI-only bootstrap (a non-developer owner cannot run it). The `create-admin` CLI remains as an emergency tool.
