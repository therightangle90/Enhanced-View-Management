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
  BACKGROUND_IMAGE_DIRECTORY: "backgroundImageDirectory"
};

const IMAGE_EXTENSIONS = /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;

Hooks.once("init", () => {
  registerSettings();
  patchSceneDirectoryCreate();
});

Hooks.on("renderSettingsConfig", (_app, html) => {
  addBackgroundDirectoryBrowseButton(html);
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

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_BACKGROUND_COLOR, {
    name: "Default background color",
    hint: "Set the default background color for newly created scenes.",
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
      choices[value] = formatGridTypeLabel(name);
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
    name: "Default token vision",
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
  const proto = SceneDirectory.prototype;
  if (!proto || proto._enhancedViewManagementPatched) return;

  proto._enhancedViewManagementPatched = true;
  const createEntryHandler = async function _onCreateEntryPatched(event) {
    event?.preventDefault?.();

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
          <label>${game.i18n.localize("EVM.BackgroundImage")}</label>
          <select name="backgroundImage">${imageChoices}</select>
        </div>
      </form>
    `;

    return Dialog.prompt({
      title: game.i18n.localize("SCENES.Create"),
      content,
      label: game.i18n.localize("SCENES.Create"),
      callback: async html => {
        const form = resolveDialogForm(html);
        if (!form) return null;
        const nameInput = form.querySelector('input[name="name"]');
        const folderInput = form.querySelector('select[name="folder"]');
        const imageInput = form.querySelector('select[name="backgroundImage"]');
        const selectedImage = imageInput?.value?.trim() ?? "";
        const enteredName = nameInput?.value?.trim() ?? "";
        const sceneData = prepareSceneData({
          name: enteredName,
          folder: folderInput?.value || null,
          img: selectedImage || null
        });

        if (!sceneData.name) {
          ui.notifications.warn(game.i18n.localize("EVM.NameOrImageRequired"));
          return null;
        }

        return Scene.create(sceneData);
      }
    });
  };

  if (globalThis.libWrapper?.register) {
    libWrapper.register(
      MODULE_ID,
      "SceneDirectory.prototype._onCreateEntry",
      function _onCreateEntryWrapped(_wrapped, event) {
        return createEntryHandler.call(this, event);
      },
      "MIXED"
    );
    return;
  }

  proto._onCreateEntry = createEntryHandler;
}

function prepareSceneData(data = {}) {
  const prepared = foundry.utils.deepClone(data);
  const initial = prepared.initial ?? {};
  const grid = prepared.grid ?? {};

  prepared.navigation ??= game.settings.get(MODULE_ID, SETTINGS.DEFAULT_NAVIGATION);
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
  const choices = [`<option value="">${game.i18n.localize("None")}</option>`];
  if (!directory) return choices.join("");

  let listing;
  try {
    listing = await collectImageListing(directory);
  } catch (error) {
    console.warn(`${MODULE_ID} | Failed to browse image directory`, error);
    ui.notifications.warn(game.i18n.format("EVM.BrowseDirectoryFailed", { directory }));
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
  return lastDot >= 0 ? filename.slice(0, lastDot) : filename;
}

function relativeDirName(parent, child) {
  const normalizedParent = parent.replace(/\/+$/, "");
  const normalizedChild = child.replace(/\/+$/, "");
  if (!normalizedChild.startsWith(`${normalizedParent}/`)) return normalizedChild;
  return normalizedChild.slice(normalizedParent.length + 1);
}

function formatGridTypeLabel(name) {
  return name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function addBackgroundDirectoryBrowseButton(html) {
  const root = html?.[0] ?? html;
  if (!root) return;

  const settingName = `${MODULE_ID}.${SETTINGS.BACKGROUND_IMAGE_DIRECTORY}`;
  const input = root.querySelector(`input[name="${settingName}"]`);
  if (!input || input.dataset.evmDirectoryPickerAttached === "true") return;

  input.dataset.evmDirectoryPickerAttached = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("file-picker");
  button.dataset.type = "folder";
  button.title = game.i18n.localize("EVM.BrowseDirectories");
  button.innerHTML = '<i class="fas fa-file-import fa-fw"></i>';
  button.addEventListener("click", async event => {
    event.preventDefault();
    await openDirectoryPicker(input);
  });

  input.insertAdjacentElement("afterend", button);
}

async function openDirectoryPicker(input) {
  const callback = path => {
    input.value = path ?? "";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const current = await resolvePickerDirectory(input.value);
  const picker = new FilePicker({
    type: "folder",
    activeSource: "data",
    current,
    callback
  });
  picker.render(true);
}

function resolveDialogForm(html) {
  const root = html?.[0] ?? html;
  if (!root) return null;
  if (root instanceof HTMLFormElement) return root;
  return root.querySelector?.("form") ?? null;
}

async function resolvePickerDirectory(path) {
  const normalized = normalizeDirectoryPath(path);
  if (!normalized) return "";

  let current = normalized;
  while (current) {
    try {
      await FilePicker.browse("data", current);
      return current;
    } catch (_error) {
      current = parentDirectory(current);
    }
  }

  return "";
}

function normalizeDirectoryPath(path) {
  return path?.trim().replace(/\/+$/, "") ?? "";
}

function parentDirectory(path) {
  const normalized = normalizeDirectoryPath(path);
  if (!normalized) return "";
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
}

const sortByLabel = createSorter(item => item.label);
const sortByPathName = createSorter(item => fileName(item));

function createSorter(keyFn) {
  return (a, b) => keyFn(a).localeCompare(keyFn(b), undefined, { sensitivity: "base" });
}
