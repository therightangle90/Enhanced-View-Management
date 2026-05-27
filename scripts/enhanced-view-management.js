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
  patchSceneDeleteDialog();
});

Hooks.on("renderDialog", (app, html) => {

  const isCustomDialog =
    app.options
      ?.classes
      ?.includes(
        "evm-create-scene-dialog"
      );

  if (!isCustomDialog) return;

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
    .find(".dialog-buttons, .form-footer, .dialog-button-group")
    .css({
      display: "flex",
      "flex-direction": "row",
      gap: "6px",
      "justify-content": "flex-end",
      "align-items": "center",
      margin: "8px 0 0 0"
    });

  html.parent()
    .find(".dialog-buttons button, .form-footer button, .dialog-button-group button")
    .css({
      flex: "0 0 auto",
      width: "auto",
      height: "28px",
      padding: "0 10px",
      "line-height": "28px",
      margin: 0
    });

});

Hooks.on(
  "preCreateScene",
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

function patchSceneDeleteDialog() {

  const originalStatic =
    Scene.deleteDialog;

  if (
    typeof originalStatic ===
    "function" &&
    !Scene.deleteDialog
      .__evmPatched
  ) {

    Scene.deleteDialog =
      async function (...args) {

        const warn =
          game.settings.get(
            MODULE_ID,
            SETTINGS
              .WARN_SCENE_DELETE
          );

        if (warn) {
          return originalStatic
            .apply(this, args);
        }

        const [
          target,
          options = {}
        ] = args;

        const ids = [];

        const pushId =
          value => {
            if (
              typeof value ===
              "string" &&
              value
            ) ids.push(value);

            else if (
              value?.id
            ) ids.push(
              value.id
            );
          };

        if (
          Array.isArray(
            target
          )
        ) {
          target.forEach(
            pushId
          );
        }

        else {
          pushId(target);
        }

        if (
          !ids.length &&
          Array.isArray(
            options?.ids
          )
        ) {
          options.ids.forEach(
            pushId
          );
        }

        if (!ids.length) {
          return originalStatic
            .apply(this, args);
        }

        return this
          .deleteDocuments(
            ids,
            options
          );
      };

    Scene.deleteDialog
      .__evmPatched = true;
  }

  const originalProto =
    Scene.prototype
      .deleteDialog;

  if (
    typeof originalProto ===
    "function" &&
    !Scene.prototype
      .deleteDialog
      .__evmPatched
  ) {

    Scene.prototype
      .deleteDialog =
      async function (...args) {

        const warn =
          game.settings.get(
            MODULE_ID,
            SETTINGS
              .WARN_SCENE_DELETE
          );

        if (warn) {
          return originalProto
            .apply(this, args);
        }

        return this.delete(
          ...args
        );
      };

    Scene.prototype
      .deleteDialog
      .__evmPatched = true;
  }
}

function registerSettings() {

  const localized = (
    key,
    type,
    defaultValue
  ) => ({
    name:
      `EVM.Settings.${key}.Name`,
    hint:
      `EVM.Settings.${key}.Hint`,
    scope: "world",
    config: true,
    type,
    default:
      defaultValue
  });

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_NAVIGATION,
    localized(
      "DefaultNavigation",
      Boolean,
      true
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_BACKGROUND_COLOR,
    localized(
      "DefaultBackgroundColor",
      String,
      "#000000"
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_INITIAL_X,
    localized(
      "DefaultInitialX",
      Number,
      0
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_INITIAL_Y,
    localized(
      "DefaultInitialY",
      Number,
      0
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_INITIAL_ZOOM,
    localized(
      "DefaultInitialZoom",
      Number,
      1
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_WIDTH,
    localized(
      "DefaultWidth",
      Number,
      4000
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_HEIGHT,
    localized(
      "DefaultHeight",
      Number,
      3000
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_PADDING,
    localized(
      "DefaultPadding",
      Number,
      0.25
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_TOKEN_VISION,
    localized(
      "DefaultTokenVision",
      Boolean,
      false
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .BACKGROUND_IMAGE_DIRECTORY,
    localized(
      "BackgroundImageDirectory",
      String,
      ""
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .WARN_SCENE_DELETE,
    localized(
      "WarnSceneDelete",
      Boolean,
      true
    )
  );

  game.settings.register(
    MODULE_ID,
    SETTINGS
      .DEFAULT_GRID_TYPE,
    {
      ...localized(
        "DefaultGridType",
        Number,
        CONST.GRID_TYPES
          .SQUARE
      ),
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
        )
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
`<option value="${escapeAttribute(p.id)}">
${escapeHtml(p.name)}
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

        classes: [
          "evm-create-scene-dialog"
        ],

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
`<optgroup label="${escapeAttribute(safeDecodeURIComponent(group))}">`
      );
    }

    for (
      const file
      of files
    ) {

      choices.push(
`<option value="${escapeAttribute(file)}">
${escapeHtml(displayFileName(file))}
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
`<option value="${escapeAttribute(f.id)}">
${escapeHtml(f.name)}
</option>`
    )

  ].join("");
}

function safeDecodeURIComponent(
  value
) {

  try {
    return decodeURIComponent(
      value
    );
  }
  catch {
    return value;
  }
}

function displayFileName(
  path
) {

  return safeDecodeURIComponent(
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

function escapeAttribute(
  value
) {

  return String(
    value ?? ""
  )
  .replace(
    /&/g,
    "&amp;"
  )
  .replace(
    /"/g,
    "&quot;"
  )
  .replace(
    /'/g,
    "&#39;"
  )
  .replace(
    /</g,
    "&lt;"
  )
  .replace(
    />/g,
    "&gt;"
  );
}

function escapeHtml(
  value
) {

  return TextEditor
    .escapeHTML(
      String(
        value ?? ""
      )
    );
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