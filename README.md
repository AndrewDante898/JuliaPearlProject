# JuliaPearlProject — local shop demonstration

The storefront currently uses **Pearl Atelier** as its demonstration brand.

## Run on another computer

Install Node.js 24 or later, then run:

```powershell
git clone https://github.com/AndrewDante898/JuliaPearlProject.git
cd JuliaPearlProject
node server.mjs
```

Open http://localhost:4173 for the shop or http://localhost:4173/admin to create that computer's local administrator. On Windows, you can also double-click `start-demo.cmd`. No `npm install` is needed.

Each computer creates its own sample database. Git does not transfer administrator credentials, customer orders or uploaded photographs. To update the code later, stop the server, run `git pull`, then start it again. Follow your employer's software policy when using a company laptop.

An original pearl jewellery storefront and studio admin. The working brand, illustrations, products, prices and shipping charges are demonstration content. No payments are processed.

## Open it

1. Double-click `start-demo.cmd` in this folder. Keep its terminal window open.
2. Open http://127.0.0.1:4173 in your browser for the shop.
3. Open http://127.0.0.1:4173/admin for the studio. On your first visit, choose an email and a new password of at least 12 characters. No email is sent or verified. There is no shared default administrator password.
4. Stop the server with Ctrl+C in its terminal. Start it again to continue; saved data remains.

Node.js 24 or later is required and is already installed on the development PC. No npm install, paid hosting, domain or subscription is needed for this demo. If the port is already in use, a copy may already be running: try opening the address first.

From PowerShell in this folder, the equivalent command is `node server.mjs`. The application is intentionally restricted to this PC. The same address on your office laptop refers to that laptop, not your home PC. Remote access and hosting need a separate setup; this demo has not been exposed to the internet.

## Try the shopping journey

- Browse the homepage, collection and individual products. Search, change category, sort prices and choose product options.
- Add a piece to the bag and adjust its quantity.
- Continue to **demo checkout**, using fictional contact details only. Example: Demo Customer, demo@example.com, 0123456789, 12 Sample Street, Kuala Lumpur, 50000.
- Choose one of the simulated card, FPX or Touch ’n Go methods. No card numbers or banking credentials are requested.
- Place the demonstration order. The server calculates prices and delivery, saves the order and reduces sample stock. The receipt explicitly confirms that no payment was taken.
- Check the order in the admin. Enter a sample courier and tracking number to mark it shipped, or cancel an unshipped order to restore stock once.

Sample delivery is RM10 for Peninsular Malaysia and RM18 for Sabah or Sarawak. These are not an agreed merchant policy.

## Use the studio

**Overview:** active products, available units, pending fulfilment and simulated order totals. Order value is not real revenue.

**Products:** add and edit pieces; upload your own PNG, JPEG or WebP photographs up to 3 MB; set descriptions, details, categories, status and homepage features. Every option has its own SKU, price and quantity. Set status to draft or archived to remove a listing from the public catalogue while retaining order history. Existing SKUs remain reserved when an option is removed.

**Categories:** add, rename and delete empty categories. Reassign all products, including archived products, before deleting an assigned category.

**Inventory:** view quantities and open a product to adjust them. Stock decreases at demo checkout, not when a piece is merely added to a bag. If a purchase or another edit changes a product while its editor is open, saving is rejected rather than overwriting newer stock. Close the editor and reload the page before editing again.

**Orders:** see saved contact/delivery details and item snapshots. Filter orders, record manual courier tracking, or cancel an unshipped order. Shipped orders cannot be cancelled through this demo. No delivery booking, customer email, refund or real payment verification takes place.

The admin currently has one owner account. Sessions expire after eight hours and are cleared when the server restarts. There is no password reset email flow or staff roles yet. On narrow screens, navigation and sign-out are across the top. Close the browser and stop the server when finished using a shared PC.

## What this is built with

- Node.js 24 built-in HTTP server and SQLite database.
- Plain HTML, CSS and browser JavaScript modules, with original local SVG illustrations.
- Persistent products, variants, categories, orders and hashed administrator credentials.
- Server-authoritative prices, transactional inventory updates, repeated-checkout protection, admin authentication, request-origin and host checks, upload type restrictions and security headers.
- No third-party runtime packages or external font requests.

This is a **custom application**, not a Shopify theme or WordPress/WooCommerce plugin. It can inform either platform's visual design, but it cannot simply be uploaded into Shopify. Shopify would require a Liquid/JSON theme and its commerce backend; WooCommerce would require a WordPress theme and commerce integration. A custom server deployment can retain this architecture but requires additional production work. No final platform decision has been made.

## Files and data

| Location | Purpose |
|---|---|
| `server.mjs` | HTTP routes, authentication and image uploads |
| `store.mjs` | SQLite persistence and order/inventory rules |
| `public/app.js` | Customer storefront and demo checkout |
| `public/admin.js` | Studio management screens |
| `public/styles.css` | Responsive storefront and admin design |
| `public/assets/` | Original demonstration illustrations |
| `data/shop.sqlite` | Local products, orders and administrator account |
| `public/uploads/` | Uploaded product photographs |
| `tests/` | Database and HTTP integration tests |

Data and uploads are excluded from Git. For a local backup, stop the server first and copy the whole `data` folder plus `public/uploads` somewhere safe. Do not delete these folders to restart the app: they contain saved work. Keep customer information out of source control and use fictional details during demonstrations.

## Verification and current limits

Run `node --test tests/*.test.mjs` on the PC. Ten store tests cover server prices, inventory reduction, idempotent checkout, insufficient/duplicate quantities, cancellation, archived products, data validation, persistence and stale admin updates. One HTTP integration test covers access control, origin checks, initial admin setup, login/logout and rejected SVG uploads.

On 1 November 2026, all ten original tests (nine store tests plus the HTTP test) passed before the final review fixes. After those fixes, all ten current store tests passed and the JavaScript syntax checks passed. The complete suite was rerun before the GitHub push: all 11 database and HTTP tests passed. Desktop homepage rendering, the mobile collection layout at 390 pixels wide, and the complete browser add-to-bag/checkout/receipt flow were checked. A fictional test order remains in the local database for review. The admin first-run screen was checked, but authenticated admin browser tests remain outstanding; your administrator has deliberately not been created for you. Do not interpret this handover as production acceptance.

Before live selling: settle the platform and hosting; replace sample assets and copy; approve delivery/returns/privacy information; configure a merchant-owned payment provider with verified payment webhooks and refunds; implement real pending/failed/cancelled payment states and stock reservations; add email delivery, full Malaysian address fields, abuse protection, backup/restore testing, monitoring, HTTPS, production security review and accessibility/device testing. No provider has been selected and the demo payment buttons do not establish provider eligibility.

The existing RM1,500 launch / RM450 monthly proposal remains a discussion baseline. It is not automatically the price for a bespoke commerce backend or server administration.

The preview server was started before the final backend review fixes. Stop it with Ctrl+C and run start-demo.cmd again to load the latest backend code before testing inventory editing.


