# Setting up Farm Records

About 20 minutes, done once. You need:

- a **Google account** (for the test version, your own; later, a farm account)
- a **GitHub account** that holds this repository

The app itself is published from GitHub. The records are stored in a Google Sheet that you own.

---

## Part 1 – Publish the app (GitHub Pages)

1. In this repository on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, the branch to **main**, the folder to **/ (root)**, and click **Save**.
3. After a minute or two the page shows the app address, e.g.
   `https://YOUR-USERNAME.github.io/farm-records/`. Keep it for Part 2.

> GitHub Pages is free for public repositories. The app code contains no farm data or passwords, so a public repository is fine. All records stay in your Google Sheet.

---

## Part 2 – Create the Google Sheet "server"

1. Go to **https://sheets.new** (signed in with the Google account that will own the records). Name the sheet **Farm Records**.
2. Click **Extensions → Apps Script**. A code editor opens in a new tab.
3. Delete everything in `Code.gs`. Paste in the whole contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repository.
4. Near the top, check the `APP_ADDRESS` line matches your app address from Part 1 (it is already set for the test version), e.g.
   `const APP_ADDRESS = 'https://YOUR-USERNAME.github.io/farm-records/';`
5. Click the 💾 **Save** icon. Rename the project (top left, "Untitled project") to **Farm Records**.
6. Go back to the Sheet tab and **reload the page**. After a few seconds a **Farm Records** menu appears next to *Help*.
7. Click **Farm Records → 1. Set up sheets**.
   - Google asks you to authorise the script. Click **Continue**, choose your account.
   - You'll see *"Google hasn't verified this app"*. This is normal for your own scripts. Click **Advanced → Go to Farm Records (unsafe) → Allow**.
   - If nothing seems to happen after allowing, click **1. Set up sheets** again.
   - You now have four tabs: **Summary**, **Animals**, **Events**, **Settings**.

### Turn it into a web app

8. Back in the Apps Script tab, click **Deploy → New deployment**.
9. Click the ⚙️ gear next to *Select type* and choose **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Click **Deploy**. Authorise again if asked (it also needs Google Drive, for photos).
11. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/…/exec`.

> "Anyone" only means the app can reach the script without a Google login. Nothing can be read or written without the farm key, which is inside the setup link.

### Get the setup link

12. In the Sheet, click **Farm Records → 2. Show app setup link** and paste the Web app URL.
13. A box shows a link. Open it on each computer or phone that will enter records. It connects that device in one click. **Treat this link like a password.**

### Fill in the Settings tab

14. In the **Settings** tab, replace *Farm manager* with the real staff names (one row each, List = `staff`), and adjust the animal types, treatment types and causes of death as needed. Each row becomes one dropdown choice in the app.
    - `species` rows need an **Option** of `Individual` (each animal has its own tag, e.g. pigs, goats) or `Batch` (counted as a group, e.g. chickens, pheasants).
    - Changes reach the app the next time it uploads.

---

## Part 3 – Set up the farm laptop

1. Install **Google Chrome** if it isn't there already.
2. Open the **setup link** from step 13. The app says *"This computer is now connected"*.
3. Install it as an app: in Chrome's address bar click the **Install** icon (a monitor with a down arrow), or use **⋮ menu → Cast, save and share → Install page as app**. This puts a **Farm Records** icon on the desktop and Start menu, and it opens in its own window.
4. Make one test entry and check it appears in the Sheet's **Events** tab within a few seconds. Delete the test row from the Sheet afterwards.

The app works with no internet. Entries are kept on the laptop and upload automatically when a connection comes back. The status box at the top right always shows how many are waiting.

**Phones:** the same setup link works on an Android phone in Chrome. Use **⋮ → Add to Home screen** to install it there.

### Remote support from the UK (free)

On the laptop, signed in to Chrome with the farm Google account:

1. Go to **https://remotedesktop.google.com/access** and click **Set up remote access**.
2. Install the small helper program it offers, give the laptop a name and choose a PIN.

From the UK, sign in to the same Google account at **https://remotedesktop.google.com/access**. The laptop appears in the list whenever it's switched on and online. Click it and enter the PIN to see and control its screen.

---

## Making changes later

| What | How |
|---|---|
| Staff names, animal types, treatment types, causes | Edit the **Settings** tab. No code needed. |
| Fix a wrong entry | Edit or delete the row in the **Events** tab. **Animals** and **Summary** refresh by themselves (or use **Farm Records → Refresh Animals & Summary**). The app picks up the fix on its next upload. |
| App screens, wording or translations | Edit the files in this repository (wording is in [`js/i18n.js`](js/i18n.js)). When the change reaches the `main` branch, the laptop gets it next time it opens the app while online. |
| The Google script (`Code.gs`) | Paste the new code into Apps Script and save. Then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The web app URL stays the same, so devices don't need setting up again. **If you skip this step the old code keeps running.** |
| A device is lost or stolen | **Farm Records → Change farm key**, then send the new setup link to the devices you still use. |

---

## Moving it to a farm account later

**Google Sheet:** sign in to the farm Google account and open the test Sheet (share it with that account first). Use **File → Make a copy**. The copy includes the script and all the data. In the copy, repeat Part 2 from step 7 (*Set up sheets* only re-adds what's missing), make a **new deployment**, and send the new setup link to the devices.

**GitHub:** on the repository go to **Settings → General → Danger Zone → Transfer ownership** and move it to the farm's GitHub account or organisation. Keep yourself as a collaborator so you can still update it. The app address changes to the new account's `github.io` address, so update `APP_ADDRESS` in `Code.gs` (then redeploy, as above) and send out a fresh setup link.
