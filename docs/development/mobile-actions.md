# Mobile Save Actions

Mobile editing screens use one bottom action area below 1024px. The list navigation is hidden while a form action bar is present, and the header menu remains available. Desktop forms retain their inline actions.

Use `MobileFormSubmitBar` with a stable form ID for forms, or `MobileActionBar` for command buttons such as invoice generation. Pass pending state, errors, and success messages so users can see the result beside the action. Keep permanent invoice deletion and unit cascade deletion available as requested; these layout changes do not alter those operations.

`useMobileViewport` follows the visual viewport height and offset in the installed iPhone app. It moves the bottom action above the keyboard and constrains dialogs to the visible area. It leaves pinch zoom enabled. Action bars measure their height so long labels, amounts, or errors reserve enough scroll space. Phone and tablet inputs use a 16px font to avoid automatic input zoom.

Run `npm run test:e2e:mobile` for WebKit checks with mocked requests. On the physical phone, check invoice editing, recording a payment, Settings, generation, and lease renewal with the keyboard open and closed, then rotate the phone. Check the final input and Save button without horizontal scrolling.

## Deployment

Vercel's connected GitHub integration publishes the production branch. CI handles lint, type checking, unit tests, mobile browser checks, dependency audit, and build. The redundant CLI deployment workflow was removed because its stored Vercel token was invalid and the Git integration already deploys this repository.

After a release, close the installed app completely and reopen it to load the updated page and service worker. Reinstalling the app is not required. The September mobile update does not require a database migration; the separate pending profile-role security migration belongs to the earlier project audit.
