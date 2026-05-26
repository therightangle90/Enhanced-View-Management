const MODULE_ID = "enhanced-view-management";

const SETTINGS = {
  DEFAULT_NAVIGATION: "defaultNavigation",
  DEFAULT_PERMISSION: "defaultPermission",
  DEFAULT_BACKGROUND_COLOR: "defaultBackgroundColor",
  DEFAULT_INITIAL_X: "defaultInitialX",
  DEFAULT_INITIAL_Y: "defaultInitialY",
  DEFAULT_INITIAL_ZOOM: "defaultInitialZoom",
  DEFAULT_GRID_TYPE: "defaultGridType",
  DEFAULT_WIDTH: "defaultWidth",
  DEFAULT_HEIGHT: "defaultHeight",
  DEFAULT_PADDING: "defaultPadding",
  DEFAULT_TOKEN_VISION: "defaultTokenVision",
  BACKGROUND_IMAGE_DIRECTORY: "backgroundImageDirectory"
};

const IMAGE_EXTENSIONS = /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;

Hooks.once("init", () => {
  registerSettings();
  patchSceneDirectoryCreate();
});

Hooks.on("preCreateScene", (scene, data) => {
  const prepared = prepareSceneData(data);
  const diff = foundry.utils.diffObject(data, prepared);
  if (!foundry.utils.isEmpty(diff)) scene.updateSource(diff);
});

function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_NAVIGATION, {
    name: "Default show in navigation",
    hint: "Set whether newly created scenes are shown in navigation by default.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_PERMISSION, {
    name: "Default permission",
    hint: "Set the default ownership level for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    choices: {
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE]: "None",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED]: "Limited",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER]: "Observer",
      [CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER]: "Owner"
    },
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_BACKGROUND_COLOR, {
    name: "Default background colour",
    hint: "Set the default background colour for newly created scenes.",
    scope: "world",
    config: true,
    type: String,
    default: "#000000"
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_INITIAL_X, {
    name: "Default initial view X",
    hint: "Set the default initial view X position for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_INITIAL_Y, {
    name: "Default initial view Y",
    hint: "Set the default initial view Y position for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_INITIAL_ZOOM, {
    name: "Default initial zoom",
    hint: "Set the default initial zoom level for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 1
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_GRID_TYPE, {
    name: "Default grid type",
    hint: "Set the default grid type for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    choices: Object.entries(CONST.GRID_TYPES).reduce((choices, [name, value]) => {
      choices[value] = name;
      return choices;
    }, {}),
    default: CONST.GRID_TYPES.SQUARE
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WIDTH, {
    name: "Default scene width",
    hint: "Set the default width for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 4000
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_HEIGHT, {
    name: "Default scene height",
    hint: "Set the default height for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 3000
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_PADDING, {
    name: "Default padding percentage",
    hint: "Set the default scene padding value for newly created scenes.",
    scope: "world",
    config: true,
    type: Number,
    default: 0.25
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_TOKEN_VISION, {
    name: "Default token visibility",
    hint: "Set whether token vision is enabled on newly created scenes.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.BACKGROUND_IMAGE_DIRECTORY, {
    name: "Background image directory",
    hint: "Directory to scan for scene background images when creating scenes.",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });
}

function patchSceneDirectoryCreate() {
  const proto = SceneDirectory?.prototype;
  if (!proto || proto._enhancedViewManagementPatched) return;

  proto._enhancedViewManagementPatched = true;
  proto._onCreateEntry = async function _onCreateEntryPatched(event) {
    event.preventDefault();

    const directory = game.settings.get(MODULE_ID, SETTINGS.BACKGROUND_IMAGE_DIRECTORY).trim();
    const imageChoices = await buildImageChoices(directory);
    const folderChoices = getFolderChoices();

    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("Name")}</label>
          <input type="text" name="name" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("FOLDER.Folder")}</label>
          <select name="folder">${folderChoices}</select>
        </div>
        <div class="form-group">
          <label>Background image</label>
          <select name="backgroundImage">${imageChoices}</select>
        </div>
      </form>
    `;

    return Dialog.prompt({
      title: game.i18n.localize("SCENES.Create"),
      content,
      label: game.i18n.localize("SCENES.Create"),
      callback: async html => {
        const form = html[0].querySelector("form");
        const selectedImage = form.backgroundImage.value.trim();
        const enteredName = form.name.value.trim();
        const name = enteredName || deriveNameFromImage(selectedImage);

        if (!name) {
          ui.notifications.warn("Please provide a scene name or choose a background image.");
          return null;
        }

        const sceneData = prepareSceneData({
          name,
          folder: form.folder.value || null,
          img: selectedImage || null
        });

        return Scene.create(sceneData);
      }
    });
  };
}

function prepareSceneData(data = {}) {
  const prepared = foundry.utils.deepClone(data);
  const initial = prepared.initial ?? {};
  const grid = prepared.grid ?? {};

  prepared.navigation ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_NAVIGATION);
  prepared.ownership = {
    ...(prepared.ownership ?? {}),
    default: prepared.ownership?.default ?? game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PERMISSION)
  };
  prepared.backgroundColor ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_BACKGROUND_COLOR);
  prepared.initial = {
    x: initial.x ?? game.settings.get(MODULE_ID, SETTINGS.DEFAULT_INITIAL_X),
    y: initial.y ?? game.settings.get(MODULE_ID, SETTINGS.DEFAULT_INITIAL_Y),
    scale: initial.scale ?? game.settings.get(MODULE_ID, SETTINGS.DEFAULT_INITIAL_ZOOM)
  };
  prepared.grid = {
    ...grid,
    type: grid.type ?? game.settings.get(MODULE_ID, SETTINGS.DEFAULT_GRID_TYPE)
  };
  prepared.width ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_WIDTH);
  prepared.height ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_HEIGHT);
  prepared.padding ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PADDING);
  prepared.tokenVision ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_TOKEN_VISION);

  if (!prepared.name?.trim() && prepared.img) {
    prepared.name = deriveNameFromImage(prepared.img);
  }

  return prepared;
}

function getFolderChoices() {
  const folders = game.folders.contents
    .filter(folder => folder.type === "Scene")
    .sort((a, b) => a.name.localeCompare(b.name));

  const choices = [`<option value="">${game.i18n.localize("None")}</option>`];
  for (const folder of folders) {
    choices.push(`<option value="${folder.id}">${TextEditor.escapeHTML(folder.name)}</option>`);
  }
  return choices.join("");
}

async function buildImageChoices(directory) {
  const choices = ["<option value=\"\">None</option>"];
  if (!directory) return choices.join("");

  let listing;
  try {
    listing = await collectImageListing(directory);
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to browse image directory`, error);
    ui.notifications.warn(`Could not browse background image directory: ${directory}`);
    return choices.join("");
  }

  for (const item of listing.root) {
    choices.push(`<option value="${item.path}">${TextEditor.escapeHTML(item.label)}</option>`);
  }

  for (const section of listing.sections) {
    choices.push(`<optgroup label="${TextEditor.escapeHTML(section.label)}">`);
    for (const item of section.images) {
      choices.push(`<option value="${item.path}">${TextEditor.escapeHTML(item.label)}</option>`);
    }
    choices.push("</optgroup>");
  }

  return choices.join("");
}

async function collectImageListing(rootDirectory) {
  const rootBrowse = await FilePicker.browse("data", rootDirectory);

  const root = (rootBrowse.files ?? [])
    .filter(isImageFile)
    .map(path => ({ path, label: fileName(path) }))
    .sort(sortByLabel);

  const sections = [];
  const dirs = [...(rootBrowse.dirs ?? [])].sort(sortByPathName);
  for (const dir of dirs) {
    await collectFromSubdirectory(dir, relativeDirName(rootDirectory, dir), sections);
  }

  return { root, sections };
}

async function collectFromSubdirectory(directory, label, sections) {
  const browse = await FilePicker.browse("data", directory);
  const images = (browse.files ?? [])
    .filter(isImageFile)
    .map(path => ({ path, label: fileName(path) }))
    .sort(sortByLabel);

  if (images.length) sections.push({ label, images });

  const dirs = [...(browse.dirs ?? [])].sort(sortByPathName);
  for (const dir of dirs) {
    const childLabel = `${label}/${relativeDirName(directory, dir)}`;
    await collectFromSubdirectory(dir, childLabel, sections);
  }
}

function isImageFile(path) {
  return IMAGE_EXTENSIONS.test(path);
}

function fileName(path) {
  return path.split("/").pop() ?? path;
}

function deriveNameFromImage(path) {
  if (!path) return "";
  const filename = fileName(path);
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function relativeDirName(parent, child) {
  const normalizedParent = parent.replace(/\/+$/, "");
  const normalizedChild = child.replace(/\/+$/, "");
  if (!normalizedChild.startsWith(`${normalizedParent}/`)) return fileName(normalizedChild);
  return normalizedChild.slice(normalizedParent.length + 1);
}

function sortByLabel(a, b) {
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

function sortByPathName(a, b) {
  return fileName(a).localeCompare(fileName(b), undefined, { sensitivity: "base" });
}
