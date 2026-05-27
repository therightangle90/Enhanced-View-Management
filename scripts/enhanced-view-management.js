const MODULE_ID = "enhanced-view-management";

const SETTINGS = {
  DEFAULT_NAVIGATION: "defaultNavigation",
  DEFAULT_BACKGROUND_COLOR: "defaultBackgroundColor",
  DEFAULT_INITIAL_X: "defaultInitialX",
  DEFAULT_INITIAL_Y: "defaultInitialY",
  DEFAULT_INITIAL_ZOOM: "defaultInitialZoom",
  DEFAULT_GRID_TYPE: "defaultGridType",
  DEFAULT_WIDTH: "defaultWidth",
  DEFAULT_HEIGHT: "defaultHeight",
  DEFAULT_PADDING: "defaultPadding",
  DEFAULT_TOKEN_VISION: "defaultTokenVision",
  BACKGROUND_IMAGE_DIRECTORY: "backgroundImageDirectory",
  WARN_SCENE_DELETE: "warnSceneDelete"
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

Hooks.once("init", () => {
  registerSettings();
  patchSceneCreateDialog();
  patchSceneDelete();
});

Hooks.on("renderSettingsConfig", (_app, html) => {
  addBackgroundDirectoryBrowseButton(html);
});

Hooks.on("renderDialog", (app, html) => {

  if (app.title !== "Create New Scene") return;

  const root =
    html.closest(".app");

  let widest = 420;

  html.find("option").each(
    (_i, el) => {

      const len =
        $(el)
          .text()
          .trim()
          .length;

      widest =
        Math.max(
          widest,
          260 + (len * 7)
        );
    }
  );

  root.css({
    width: `${widest}px`,
    "max-width": "95vw"
  });

  html.find(".form-group")
    .css({
      display: "grid",
      "grid-template-columns":
        "180px 1fr",
      gap: "8px",
      "align-items":
        "center",
      margin:
        "0 0 6px 0"
    });

  html.find(
    "select,input"
  ).css({
    width: "100%"
  });

  html.parent()
    .find(".dialog-buttons")
    .css({
      display: "flex",
      gap: "6px",
      "justify-content":
        "flex-end",
      margin:
        "8px 0 0 0"
    });

  html.parent()
    .find(
      ".dialog-buttons button"
    )
    .css({
      flex: "0 0 auto",
      height: "28px",
      padding:
        "0 10px",
      "line-height":
        "28px",
      margin: 0
    });

});

Hooks.on("preCreateScene",
  (scene, data) => {

    const prepared =
      prepareSceneData(data);

    const diff =
      foundry.utils.diffObject(
        data,
        prepared
      );

    if (
      !foundry.utils.isEmpty(
        diff
      )
    ) {
      scene.updateSource(diff);
    }
  }
);

function patchSceneDelete() {

  const proto =
    SceneDirectory?.prototype;

  if (
    !proto ||
    typeof proto._onDeleteEntry !==
    "function"
  ) return;

  if (
    proto._onDeleteEntry
      .__evmPatched
  ) return;

  const original =
    proto._onDeleteEntry;

  proto._onDeleteEntry =
    async function (li) {

      if (
        !game.settings.get(
          MODULE_ID,
          SETTINGS.WARN_SCENE_DELETE
        )
      ) {

        const documentId =
          li instanceof jQuery
            ? li.data("document-id")
            : li?.dataset?.documentId;

        const scene =
          game.scenes?.get(
            documentId
          );

        if (scene) {
          return scene.delete();
        }
      }

      return original.call(
        this,
        li
      );
    };

  proto._onDeleteEntry
    .__evmPatched = true;
}

function patchSceneCreateDialog() {

  const original =
    Scene.createDialog;

  if (
    typeof original !==
    "function"
  ) return;

  if (
    Scene.createDialog
      .__evmPatched
  ) return;

  Scene.createDialog =
    async function (...args) {

      try {
        return await
          showCreateSceneDialog();
      }
      catch (err) {

        console.error(err);

        return original.apply(
          this,
          args
        );
      }
    };

  Scene.createDialog
    .__evmPatched = true;
}

function registerSettings() {

  for (
    const [key, type, def] of [

      [SETTINGS.DEFAULT_NAVIGATION, Boolean, true],
      [SETTINGS.DEFAULT_BACKGROUND_COLOR, String, "#000000"],
      [SETTINGS.DEFAULT_INITIAL_X, Number, 0],
      [SETTINGS.DEFAULT_INITIAL_Y, Number, 0],
      [SETTINGS.DEFAULT_INITIAL_ZOOM, Number, 1],
      [SETTINGS.DEFAULT_WIDTH, Number, 4000],
      [SETTINGS.DEFAULT_HEIGHT, Number, 3000],
      [SETTINGS.DEFAULT_PADDING, Number, 0.25],
      [SETTINGS.DEFAULT_TOKEN_VISION, Boolean, false],
      [SETTINGS.BACKGROUND_IMAGE_DIRECTORY, String, ""],
      [SETTINGS.WARN_SCENE_DELETE, Boolean, true]

    ]
  ) {

    const localizedKeyBase = key
      .charAt(0)
      .toUpperCase() +
      key.slice(1);

    game.settings.register(
      MODULE_ID,
      key,
      {
        name: `EVM.Settings.${localizedKeyBase}.Name`,
        hint: `EVM.Settings.${localizedKeyBase}.Hint`,
        scope: "world",
        config: true,
        type,
        default: def
      }
    );
  }

  game.settings.register(
    MODULE_ID,
    SETTINGS.DEFAULT_GRID_TYPE,
    {
      name: "EVM.Settings.DefaultGridType.Name",
      hint: "EVM.Settings.DefaultGridType.Hint",
      scope: "world",
      config: true,
      type: Number,

      choices:
        Object.entries(
          CONST.GRID_TYPES
        ).reduce(
          (
            o,
            [n, v]
          ) => {

            o[v] =
              formatGridTypeLabel(
                n
              );

            return o;

          },
          {}
        ),

      default:
        CONST.GRID_TYPES
          .SQUARE
    }
  );
}

function prepareSceneData(
  data = {}
) {

  const prepared =
    foundry.utils
      .deepClone(
        data
      );

  prepared.navigation ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_NAVIGATION
    );

  prepared.backgroundColor ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_BACKGROUND_COLOR
    );

  prepared.width ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_WIDTH
    );

  prepared.height ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_HEIGHT
    );

  prepared.padding ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_PADDING
    );

  prepared.tokenVision ??=
    game.settings.get(
      MODULE_ID,
      SETTINGS
        .DEFAULT_TOKEN_VISION
    );

  return prepared;
}

async function showCreateSceneDialog() {

  const directory =
    game.settings
      .get(
        MODULE_ID,
        SETTINGS
          .BACKGROUND_IMAGE_DIRECTORY
      )
      .trim();

  const imageChoices =
    await buildImageChoices(
      directory
    );

  const folders =
    (
      game.folders
        ?.contents ?? []
    )
    .filter(
      f =>
        f.type ===
        "Scene"
    )
    .sort(
      (a, b) =>
        a.name
          .localeCompare(
            b.name
          )
    );

  const playlists =
    (
      game.playlists
        ?.contents ?? []
    )
    .sort(
      (a, b) =>
        a.name
          .localeCompare(
            b.name
          )
    );

  const content = `
<form>

<div class="form-group">
<label>Name</label>
<input
id="evm-scene-name"
type="text"
/>
</div>

${
folders.length
? `
<div class="form-group">
<label>Folder</label>
<select id="evm-scene-folder">
${getFolderChoices()}
</select>
</div>
`
: ""
}

<div class="form-group">
<label>Background Image</label>
<select id="evm-scene-background">
${imageChoices}
</select>
</div>

<div class="form-group">
<label>Scene Playlist</label>
<select id="evm-scene-playlist">

<option value="">
None
</option>

${
playlists.map(
p =>
`<option value="${p.id}">
${p.name}
</option>`
).join("")
}

</select>
</div>

</form>
`;

  const createScene =
    async html => {

    let name =
      html.find(
        "#evm-scene-name"
      )
      .val()
      ?.trim() ?? "";

    const folder =
      html.find(
        "#evm-scene-folder"
      )
      .val() ||
      null;

    const image =
      html.find(
        "#evm-scene-background"
      )
      .val() ||
      "";

    const playlist =
      html.find(
        "#evm-scene-playlist"
      )
      .val() ||
      null;

    if (
      !name &&
      image
    ) {
      name =
        displayFileName(
          image
        );
    }

    if (!name) {

      name =
        Scene.implementation
          .defaultName?.() ??
        game.i18n.localize(
          "SCENES.Scene"
        ) ??
        "Scene";
    }

    const sceneData = {
      name,
      folder
    };

    if (image) {
      sceneData.background = {
        src: image
      };
    }

    if (playlist) {
      sceneData.playlist =
        playlist;
    }

    return Scene.create(
      prepareSceneData(
        sceneData
      )
    );
  };

  return new Promise(
    resolve => {

      const d =
        new Dialog({

        title:
          "Create New Scene",

        content,

        buttons: {

          create: {

            icon:
              '<i class="fas fa-check"></i>',

            label:
              "Create",

            callback:
              async html =>
                resolve(
                  await createScene(
                    html
                  )
                )
          },

          cancel: {

            icon:
              '<i class="fas fa-times"></i>',

            label:
              "Cancel",

            callback:
              () =>
                resolve(
                  null
                )
          }
        },

        default:
          "create",

        close:
          () =>
            resolve(
              null
            )

      });

      d.render(
        true
      );
    }
  );
}

async function buildImageChoices(
  directory
) {

  const choices = [
    `<option value="">None</option>`
  ];

  if (
    !directory
  ) {
    return choices
      .join("");
  }

  async function scan(
    path,
    group = null
  ) {

    let browse;

    try {

      browse =
        await FilePicker.browse(
          "data",
          path
        );

    }
    catch {
      return;
    }

    const files =
      (
        browse.files ??
        []
      )
      .filter(
        f =>
          IMAGE_EXTENSIONS
            .test(f)
      )
      .sort();

    if (
      group &&
      files.length
    ) {
      choices.push(
`<optgroup label="${decodeURIComponent(group)}">`
      );
    }

    for (
      const file
      of files
    ) {

      choices.push(
`<option value="${file}">
${displayFileName(file)}
</option>`
      );
    }

    if (
      group &&
      files.length
    ) {
      choices.push(
        "</optgroup>"
      );
    }

    for (
      const dir
      of (
        browse.dirs ??
        []
      )
      .sort()
    ) {

      await scan(
        dir,
        fileName(
          dir
        )
      );
    }
  }

  await scan(
    directory
  );

  return choices
    .join("");
}

function getFolderChoices() {

  return [

    `<option value="">
None
</option>`,

    ...(
      game.folders
        ?.contents ??
      []
    )
    .filter(
      f =>
        f.type ===
        "Scene"
    )
    .map(
      f =>
`<option value="${f.id}">
${f.name}
</option>`
    )

  ].join("");
}

function displayFileName(
  path
) {

  return decodeURIComponent(
    fileName(
      path
    )
  )
  .replace(
    /\.[^.]+$/,
    ""
  );
}

function fileName(
  path
) {

  return path
    .split("/")
    .pop() ??
    path;
}

function addBackgroundDirectoryBrowseButton(
  html
) {

  const input =
    html.find(
      `input[name="${MODULE_ID}.${SETTINGS.BACKGROUND_IMAGE_DIRECTORY}"]`
    );

  if (!input.length) return;

  const button = $(
    `<button type="button" style="width:auto;margin-left:4px" title="${game.i18n.localize("EVM.BrowseDirectories")}">` +
    `<i class="fas fa-folder-open"></i>` +
    `</button>`
  );

  button.on("click", async () => {

    const current =
      input.val()?.trim() || "";

    const picker =
      new FilePicker({
        type: "folder",
        current,
        callback: path => {
          input.val(path).trigger("change");
        }
      });

    picker.render(true);
  });

  input.after(button);

  input
    .closest(".form-group")
    .find(
      ".form-fields"
    )
    .css({
      display: "flex",
      "align-items": "center"
    });
}

function formatGridTypeLabel(
  name
) {

  return name
    .toLowerCase()
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      c =>
        c.toUpperCase()
    );
}