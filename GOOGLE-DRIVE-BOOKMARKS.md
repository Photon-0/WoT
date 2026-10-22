# Google Drive bookmark sync

The reader can keep one shared bookmark in a private JSON file in your Google
Drive. The Apps Script web app reads and updates that file. The first save
creates it; later saves replace its contents.

## Set up the Google endpoint

1. Open [script.google.com](https://script.google.com/) while signed into the
   Google account whose Drive should hold the bookmark.
2. Create a new project and replace the contents of `Code.gs` with
   [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
3. Choose **Deploy > New deployment**, select **Web app**, and set **Execute
   as** to **Me**.
4. Set **Who has access** to **Anyone**, then deploy and approve the requested
   Drive permissions.
5. Copy the web app URL ending in `/exec`.

If Google does not offer anonymous **Anyone** access for your account, this
no-sign-in setup will not work with that account.

If you already deployed the earlier pixel-based bookmark script, replace its
`Code.gs` with the updated version and edit the deployment to use a new version.
Otherwise, the existing endpoint will reject percentage-based saves.

## Connect devices

Deploy the reader to GitHub Pages and open it over HTTPS. On each device, use
**Save bookmark** or **Resume bookmark** and paste the web app URL when
prompted. The URL is saved in that browser on that device. The reader fetches
the shared bookmark when opened and before resuming; saving updates the Drive
file.

The bookmark contains the page URL and percentage of the chapter's scrollable
height, so it resumes at roughly the same relative position on screens with
different sizes. Existing bookmarks saved in pixels continue to work; new
saves use percentages. To avoid sending private information to a public
endpoint, do not add personal data to the bookmark.

## Access warning

The web app runs as you and its URL is embedded in the public reader at use
time. Anyone who obtains that URL can read or overwrite the one shared
bookmark. Do not store secrets or other private information in the bookmark.
The Drive file itself remains in your Drive; the web app is the public gateway
to that one value.
