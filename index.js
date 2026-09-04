require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder,
    Events,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    LabelBuilder,
    FileUploadBuilder,
    AttachmentBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const http = require("http");
const {
    createCanvas,
    loadImage
} = require("@napi-rs/canvas");

const WELCOME_IMAGE_PATH = path.join(
    __dirname,
    "SAM-STUDIO.png"
);

let welcomeTemplatePromise = null;

// ================= CONFIG & ENV =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1536547186962333777";
const PANEL_CHANNEL_ID = "1526597563736916028";
const STAFF_ROLE_ID = "1526597468861763825";
const LEGACY_STAFF_ROLE_ID = "686569170330058753";
const VERIFIED_ROLE_ID = "1526597473970294914";
const WELCOME_CHANNEL_ID = "1526597511228166267";
const GOODBYE_CHANNEL_ID = "1536548597078691950";
const CLOSED_CATEGORY_ID = "1544914321090543626";

// Log Channels
const LOG_CHANNELS = {
    MOD: "1536548714297032794",
    TICKET: "1544912522874851448",
    MSG: "1544912711664664586",
    VC: "1544912908084056114",
    JOIN: process.env.JOIN_LEAVE_LOGS,
    ROLE: "1544912807303192576",
    SERVER: process.env.SERVER_LOGS,
    INVITE: "1544913016426991726",
    NICKNAME: "1544913108638629960"
};

// ================= TICKET CATEGORIES =================
// Agar .env me IDs nahi doge to bot khud category
// name se find/create kar dega.

const CATEGORY_IDS = {
    pre_purchase: "1544913384695402496",
    script_support: "1531650428322971769",
    partners: "1544914210524241970"
};

const CATEGORY_NAMES = {
    pre_purchase: "Pre-purchase Questions",
    script_support: "Script Support",
    partners: "Partners"
};

const TICKET_LABELS = {
    pre_purchase: "Pre-purchase Questions",
    script_support: "Script Support",
    partners: "Partners"
};

const TICKET_DESCRIPTIONS = {
    pre_purchase:
        "Need details before purchase? Our team is here to guide you anytime.",
    script_support:
        "Get script support, bug fixes, and guidance from our staff anytime.",
    partners:
        "Discover our trusted partners and amazing communities. Check out their projects and support them!"
};

// Emojis
const EMOJIS = {
    pre_purchase: "❓",
    script_support: "🔧",
    partners: "🌟"
};

const TICKET_PANEL_DESCRIPTION =
    "1. Do not tag, ping, or DM unless requested.\n" +
    "2. No hate speech, bullying, or discrimination of any kind.\n" +
    "3. Select the correct category when opening tickets.\n" +
    "4. No support for leaked, stolen, or resold scripts.\n\n" +
    "**Select a category below to open a ticket.**";

// ================= DATA STORES =================
let warnings = {};
let antiSpamChannels = new Set();
let antiLinkChannels = new Set();
let antiMentionChannels = new Set();
let activeGiveaways = new Map();
let invites = new Map();

// Message builder drafts stay private and expire automatically.
const messageDrafts = new Map();
const MESSAGE_STORE_FILE = path.join(
    __dirname,
    "sam_message_data.json"
);
const MESSAGE_UPLOAD_DIR = path.join(
    __dirname,
    "sam_message_uploads"
);

const MESSAGE_TEMPLATES = {
    blank: {
        title: "",
        content: "",
        buttons: []
    },
    script_release: {
        title: "New Script Release",
        content:
            "A new SAM STUDIO script is now available.\n\n**Features**\n- Add feature details here\n- Add compatibility details here\n- Add installation details here",
        buttons: []
    },
    update: {
        title: "Script Update",
        content:
            "A new update is now available.\n\n**Changes**\n- Add update details here\n- Add fixes here",
        buttons: []
    },
    sale: {
        title: "Limited-Time Sale",
        content:
            "Our special sale is live now. Add the discount, expiry time, and product details here.",
        buttons: []
    },
    announcement: {
        title: "SAM STUDIO Announcement",
        content:
            "Write the complete announcement here.",
        buttons: []
    },
    partnership: {
        title: "Official Partnership",
        content:
            "We are pleased to announce our new partnership. Add the complete details here.",
        buttons: []
    }
};

function loadMessageStore() {
    try {
        if (!fs.existsSync(MESSAGE_STORE_FILE)) {
            return {
                messages: {},
                scheduled: {}
            };
        }

        const parsed = JSON.parse(
            fs.readFileSync(
                MESSAGE_STORE_FILE,
                "utf8"
            )
        );

        return {
            messages:
                parsed.messages &&
                typeof parsed.messages === "object"
                    ? parsed.messages
                    : {},
            scheduled:
                parsed.scheduled &&
                typeof parsed.scheduled === "object"
                    ? parsed.scheduled
                    : {}
        };
    } catch (error) {
        console.error(
            "Could not load SAM message data:",
            error.message
        );

        return {
            messages: {},
            scheduled: {}
        };
    }
}

let messageStore = loadMessageStore();

function saveMessageStore() {
    try {
        fs.writeFileSync(
            MESSAGE_STORE_FILE,
            JSON.stringify(
                messageStore,
                null,
                2
            ),
            "utf8"
        );
    } catch (error) {
        console.error(
            "Could not save SAM message data:",
            error.message
        );
    }
}

// ================= ANTI PING =================
const ANTI_PING_MEMBERS = new Set();
const ANTI_PING_ROLE_ID = "1215053255416217612";
const antiPingAttempts = new Map();

// ================= CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.User
    ],
});

// ================= HELPER =================
async function sendLog(guild, channelId, embed) {
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);

    if (channel) {
        channel.send({
            embeds: [embed]
        }).catch(() => {});
    }
}

function getWelcomeTemplate() {
    if (!welcomeTemplatePromise) {
        welcomeTemplatePromise =
            loadImage(
                WELCOME_IMAGE_PATH
            ).catch(error => {
                welcomeTemplatePromise = null;
                throw error;
            });
    }

    return welcomeTemplatePromise;
}

async function makeWelcomeImage(member) {
    const [background, avatar] =
        await Promise.all([
            getWelcomeTemplate(),
            loadImage(
                member.displayAvatarURL({
                    extension: "png",
                    size: 512,
                    forceStatic: true
                })
            )
        ]);

    const canvas = createCanvas(
        background.width,
        background.height
    );

    const context = canvas.getContext("2d");

    context.drawImage(
        background,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Coordinates measured from the original 2172 x 724 template.
    const scaleX =
        canvas.width / 2172;
    const scaleY =
        canvas.height / 724;
    const centerX =
        1822 * scaleX;
    const centerY =
        361.5 * scaleY;
    const radiusX =
        210.5 * scaleX;
    const radiusY =
        210.5 * scaleY;

    context.save();
    context.beginPath();
    context.ellipse(
        centerX,
        centerY,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2
    );
    context.closePath();
    context.clip();

    const targetWidth =
        radiusX * 2;
    const targetHeight =
        radiusY * 2;
    const avatarScale = Math.max(
        targetWidth / avatar.width,
        targetHeight / avatar.height
    );
    const drawWidth =
        avatar.width * avatarScale;
    const drawHeight =
        avatar.height * avatarScale;

    context.drawImage(
        avatar,
        centerX - drawWidth / 2,
        centerY - drawHeight / 2,
        drawWidth,
        drawHeight
    );
    context.restore();

    return canvas.encode("png");
}

function isValidHttpUrl(value) {
    if (!value) return false;

    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch (e) {
        return false;
    }
}

function parseMessageButtons(rawValue) {
    const lines = String(rawValue || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length > 5) {
        throw new Error("Maximum 5 buttons are allowed.");
    }

    return lines.map((line, index) => {
        const separatorIndex = line.indexOf("|");

        if (separatorIndex === -1) {
            throw new Error(
                `Button ${index + 1}: use Button Name | https://link.com`
            );
        }

        const parts = line.split("|").map(part => part.trim());
        const label = parts[0];
        const url = parts[1];
        const emoji = parts.slice(2).join("|").trim();

        if (!label || label.length > 80) {
            throw new Error(
                `Button ${index + 1}: name must be between 1 and 80 characters.`
            );
        }

        if (!isValidHttpUrl(url) || url.length > 512) {
            throw new Error(
                `Button ${index + 1}: enter a valid http:// or https:// link.`
            );
        }

        return {
            label,
            url,
            emoji: emoji || null
        };
    });
}

function hasMessageBuilderPermission(member) {
    return Boolean(
        member?.permissions?.has(
            PermissionsBitField.Flags.ManageMessages
        ) ||
        isStaffMember(member)
    );
}

function makeDraftId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8)
    );
}

function buttonsToInput(buttons = []) {
    return buttons.map(button =>
        [button.label, button.url, button.emoji]
            .filter(Boolean)
            .join(" | ")
    ).join("\n");
}

function cloneTemplate(templateName) {
    const template =
        MESSAGE_TEMPLATES[templateName] ||
        MESSAGE_TEMPLATES.blank;

    return JSON.parse(JSON.stringify(template));
}

function createMessageDraft({
    interaction,
    templateName = "blank",
    source = null,
    mode = "new",
    messageId = null
}) {
    const template = source || cloneTemplate(templateName);
    const id = makeDraftId();

    const draft = {
        id,
        ownerId: interaction.user.id,
        guildId: interaction.guildId,
        channelId:
            template.channelId ||
            interaction.channelId,
        title: template.title || "",
        content: template.content || "",
        buttons: Array.isArray(template.buttons)
            ? template.buttons
            : [],
        images: Array.isArray(template.images)
            ? template.images
            : [],
        accentColor:
            Number.isInteger(template.accentColor)
                ? template.accentColor
                : 0x8B0000,
        footer: template.footer || "",
        ping: template.ping || "none",
        reactions: Array.isArray(template.reactions)
            ? template.reactions
            : ["❤️", "🔥", "😊"],
        scheduleAt: null,
        mode,
        messageId,
        originalChannelId:
            mode === "edit"
                ? template.channelId || interaction.channelId
                : null,
        clearExistingAttachments: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    messageDrafts.set(id, draft);
    return draft;
}

function getOwnedDraft(interaction, draftId) {
    const draft = messageDrafts.get(draftId);

    if (!draft || draft.ownerId !== interaction.user.id) {
        return null;
    }

    draft.updatedAt = Date.now();
    return draft;
}

function addOptionalValue(input, value) {
    if (value) input.setValue(String(value).slice(0, 4000));
    return input;
}

function buildMessageModal(draft) {
    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId("msg_channel")
        .setPlaceholder("Select destination channel")
        .setChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
        )
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);

    if (draft.channelId) {
        channelSelect.setDefaultChannels(draft.channelId);
    }

    const titleInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_title")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: SAM Scale")
            .setMaxLength(200)
            .setRequired(false),
        draft.title
    );

    const contentInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_content")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Write the complete message here...")
            .setMaxLength(3500)
            .setRequired(false),
        draft.content
    );

    const buttonsInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_buttons")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                "Shop | https://link.com | 🛒\nVideo | https://youtube.com | ▶️"
            )
            .setMaxLength(3000)
            .setRequired(false),
        buttonsToInput(draft.buttons)
    );

    const imageUpload = new FileUploadBuilder()
        .setCustomId("msg_images")
        .setMinValues(0)
        .setMaxValues(10)
        .setRequired(false);

    return new ModalBuilder()
        .setCustomId(`msg_main_modal:${draft.id}`)
        .setTitle(
            draft.mode === "edit"
                ? "Edit SAM STUDIO Message"
                : "SAM STUDIO Message Builder"
        )
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Destination Channel")
                .setDescription(
                    draft.mode === "edit"
                        ? "Keep the original channel; use Duplicate to copy elsewhere."
                        : "Select the channel—no ID is needed."
                )
                .setChannelSelectMenuComponent(channelSelect),
            new LabelBuilder()
                .setLabel("Title (Optional)")
                .setTextInputComponent(titleInput),
            new LabelBuilder()
                .setLabel("Full Message (Optional)")
                .setTextInputComponent(contentInput),
            new LabelBuilder()
                .setLabel("Pictures (Optional)")
                .setDescription(
                    draft.images.length
                        ? "Upload new pictures to replace the current ones; leave empty to keep them."
                        : "Upload up to 10 PNG, JPG, GIF, or WEBP pictures."
                )
                .setFileUploadComponent(imageUpload),
            new LabelBuilder()
                .setLabel("Custom Buttons (Optional)")
                .setDescription("Name | Link | Emoji (emoji is optional)")
                .setTextInputComponent(buttonsInput)
        );
}

function buildAdvancedMessageModal(draft) {
    const colorInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_color")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("#8B0000")
            .setMaxLength(7)
            .setRequired(false),
        `#${draft.accentColor.toString(16).padStart(6, "0").toUpperCase()}`
    );

    const footerInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_footer")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Example: SAM STUDIO • Premium Scripts")
            .setMaxLength(300)
            .setRequired(false),
        draft.footer
    );

    const pingInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_ping")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("none, everyone, or Role ID")
            .setMaxLength(25)
            .setRequired(false),
        draft.ping === "none" ? "" : draft.ping
    );

    const reactionsInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_reactions")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("❤️ 🔥 😊  (blank = no reactions)")
            .setMaxLength(100)
            .setRequired(false),
        draft.reactions.join(" ")
    );

    const scheduleInput = addOptionalValue(
        new TextInputBuilder()
            .setCustomId("msg_schedule")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("10m, 2h, 1d, or 2026-09-05T18:30:00Z")
            .setMaxLength(40)
            .setRequired(false),
        draft.scheduleAt
            ? new Date(draft.scheduleAt).toISOString()
            : ""
    );

    return new ModalBuilder()
        .setCustomId(`msg_advanced_modal:${draft.id}`)
        .setTitle("Advanced Message Settings")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Accent Colour (Optional)")
                .setTextInputComponent(colorInput),
            new LabelBuilder()
                .setLabel("Footer (Optional)")
                .setTextInputComponent(footerInput),
            new LabelBuilder()
                .setLabel("Ping (Optional)")
                .setDescription("Use none, everyone, or a role ID.")
                .setTextInputComponent(pingInput),
            new LabelBuilder()
                .setLabel("Reactions (Optional)")
                .setDescription("Separate emojis with spaces.")
                .setTextInputComponent(reactionsInput),
            new LabelBuilder()
                .setLabel("Schedule (Optional)")
                .setDescription("Leave blank to send immediately.")
                .setTextInputComponent(scheduleInput)
        );
}

function parseAccentColor(value) {
    const clean = String(value || "").trim();
    if (!clean) return 0x8B0000;

    if (!/^#?[0-9a-f]{6}$/i.test(clean)) {
        throw new Error("Accent colour must look like #8B0000.");
    }

    return parseInt(clean.replace("#", ""), 16);
}

function parseMessagePing(value, guild) {
    const clean = String(value || "").trim();
    if (!clean || clean.toLowerCase() === "none") return "none";

    if (["everyone", "@everyone"].includes(clean.toLowerCase())) {
        return "everyone";
    }

    const roleId = clean.replace(/[<@&>\s]/g, "");
    if (!/^\d{17,20}$/.test(roleId) || !guild.roles.cache.has(roleId)) {
        throw new Error("Ping must be none, everyone, or a valid Role ID.");
    }

    return roleId;
}

function parseMessageReactions(value) {
    const clean = String(value || "").trim();
    if (!clean) return [];

    const reactions = clean.split(/\s+/).filter(Boolean);
    if (reactions.length > 5) {
        throw new Error("Maximum 5 reactions are allowed.");
    }

    return reactions;
}

function parseMessageSchedule(value) {
    const clean = String(value || "").trim();
    if (!clean || clean.toLowerCase() === "now") return null;

    let timestamp;
    const duration = clean.match(/^(\d+)(m|h|d)$/i);

    if (duration) {
        const unitMs = {
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000
        }[duration[2].toLowerCase()];

        timestamp = Date.now() + Number(duration[1]) * unitMs;
    } else {
        timestamp = Date.parse(clean);
    }

    if (!Number.isFinite(timestamp) || timestamp < Date.now() + 30_000) {
        throw new Error(
            "Schedule must be at least 30 seconds ahead. Use 10m, 2h, 1d, or an ISO UTC date."
        );
    }

    return timestamp;
}

function messagePingText(draft) {
    if (draft.ping === "everyone") return "@everyone";
    if (/^\d{17,20}$/.test(draft.ping || "")) {
        return `<@&${draft.ping}>`;
    }
    return "";
}

function messageAllowedMentions(draft) {
    if (draft.ping === "everyone") {
        return {
            parse: ["everyone"],
            roles: [],
            users: []
        };
    }

    if (/^\d{17,20}$/.test(draft.ping || "")) {
        return {
            parse: [],
            roles: [draft.ping],
            users: []
        };
    }

    return {
        parse: [],
        roles: [],
        users: []
    };
}

function safeButton(button) {
    const builder = new ButtonBuilder()
        .setLabel(button.label)
        .setStyle(ButtonStyle.Link)
        .setURL(button.url);

    if (button.emoji) {
        try {
            builder.setEmoji(button.emoji);
        } catch (error) {
            // Invalid emoji is ignored; the button itself still works.
        }
    }

    return builder;
}

function buildMessageContainer(draft, mediaUrls = []) {
    const displayParts = [];
    const pingText = messagePingText(draft);

    if (pingText) displayParts.push(pingText);
    if (draft.title) displayParts.push(`## ⚡ ${draft.title}`);
    if (draft.content) displayParts.push(draft.content);
    if (!draft.title && !draft.content) {
        displayParts.push("## ⚡ SAM STUDIO");
    }

    const container = new ContainerBuilder()
        .setAccentColor(draft.accentColor)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(displayParts.join("\n\n"))
        );

    if (mediaUrls.length) {
        const gallery = new MediaGalleryBuilder();

        mediaUrls.forEach((url, index) => {
            gallery.addItems(item =>
                item
                    .setURL(url)
                    .setDescription(
                        `${draft.title || "SAM STUDIO"} image ${index + 1}`
                    )
            );
        });

        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addMediaGalleryComponents(gallery);
    }

    if (draft.buttons.length) {
        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    draft.buttons.map(safeButton)
                )
            );
    }

    if (draft.footer) {
        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${draft.footer}`)
            );
    }

    return container;
}

function buildDraftPreview(draft, includeFlags = true) {
    const mediaUrls = draft.images
        .map(image => image.url)
        .filter(Boolean);

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`msg_send:${draft.id}`)
            .setLabel(draft.scheduleAt ? "Schedule" : "Send")
            .setEmoji(draft.scheduleAt ? "⏰" : "✅")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`msg_edit:${draft.id}`)
            .setLabel("Edit")
            .setEmoji("✏️")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`msg_advanced:${draft.id}`)
            .setLabel("Advanced")
            .setEmoji("⚙️")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`msg_copy:${draft.id}`)
            .setLabel("Duplicate")
            .setEmoji("📋")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`msg_cancel:${draft.id}`)
            .setLabel("Cancel")
            .setEmoji("✖️")
            .setStyle(ButtonStyle.Danger)
    );

    const components = [
        new TextDisplayBuilder().setContent(
            `### Private Preview\nDestination: <#${draft.channelId}>` +
            (draft.scheduleAt
                ? ` • Scheduled: <t:${Math.floor(draft.scheduleAt / 1000)}:F>`
                : "")
        ),
        buildMessageContainer(draft, mediaUrls),
        controls
    ];

    if (draft.images.length) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`msg_clear_images:${draft.id}`)
                    .setLabel("Remove All Pictures")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    const payload = { components };
    if (includeFlags) {
        payload.flags =
            MessageFlags.Ephemeral |
            MessageFlags.IsComponentsV2;
    }

    return payload;
}

function fileExtension(image) {
    const match = String(image.name || "")
        .match(/\.(png|jpe?g|gif|webp)$/i);

    if (match) return match[1].toLowerCase().replace("jpeg", "jpg");

    return {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp"
    }[image.contentType] || "png";
}

function buildTargetMessagePayload(draft) {
    const files = [];
    const mediaUrls = draft.images.map((image, index) => {
        if (!image.needsUpload) return image.url;

        const name =
            `sam-${draft.id}-${index + 1}.${fileExtension(image)}`;

        files.push({
            attachment: image.localPath || image.url,
            name
        });

        return `attachment://${name}`;
    });

    const payload = {
        components: [buildMessageContainer(draft, mediaUrls)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: messageAllowedMentions(draft)
    };

    if (files.length) payload.files = files;
    if (draft.mode === "edit" && draft.clearExistingAttachments) {
        payload.attachments = [];
    }

    return payload;
}

function recordFromDraft(draft, sentMessage) {
    const attachmentImages = Array.from(
        sentMessage.attachments.values()
    ).map(attachment => ({
        url: attachment.url,
        name: attachment.name,
        contentType: attachment.contentType || null,
        needsUpload: false
    }));

    return {
        guildId: draft.guildId,
        channelId: sentMessage.channelId,
        messageId: sentMessage.id,
        title: draft.title,
        content: draft.content,
        buttons: draft.buttons,
        images: attachmentImages.length
            ? attachmentImages
            : draft.images.filter(image => !image.needsUpload),
        accentColor: draft.accentColor,
        footer: draft.footer,
        ping: draft.ping,
        reactions: draft.reactions,
        updatedBy: draft.ownerId,
        updatedAt: Date.now()
    };
}

async function getDraftChannel(draft) {
    const guild = client.guilds.cache.get(draft.guildId);
    if (!guild) throw new Error("Server was not found.");

    const channel =
        guild.channels.cache.get(draft.channelId) ||
        await guild.channels.fetch(draft.channelId).catch(() => null);

    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
        throw new Error("Destination channel was not found or is not sendable.");
    }

    const botPermissions = channel.permissionsFor(guild.members.me);
    if (
        !botPermissions?.has(PermissionsBitField.Flags.ViewChannel) ||
        !botPermissions?.has(PermissionsBitField.Flags.SendMessages)
    ) {
        throw new Error("I do not have permission to send in that channel.");
    }

    return channel;
}

async function deliverMessageDraft(draft) {
    const channel = await getDraftChannel(draft);
    const payload = buildTargetMessagePayload(draft);
    let sentMessage;

    if (draft.mode === "edit" && draft.messageId) {
        const original = await channel.messages
            .fetch(draft.messageId)
            .catch(() => null);

        if (!original || original.author.id !== client.user.id) {
            throw new Error("The original bot message was not found.");
        }

        sentMessage = await original.edit(payload);
    } else {
        sentMessage = await channel.send(payload);
    }

    for (const emoji of draft.reactions) {
        await sentMessage.react(emoji).catch(() => {});
    }

    const previousId = draft.messageId;
    if (previousId && previousId !== sentMessage.id) {
        delete messageStore.messages[previousId];
    }

    messageStore.messages[sentMessage.id] =
        recordFromDraft(draft, sentMessage);
    saveMessageStore();

    const log = new EmbedBuilder()
        .setColor(draft.accentColor)
        .setTitle(
            draft.mode === "edit"
                ? "Message Edited"
                : "Message Sent"
        )
        .addFields(
            {
                name: "Staff",
                value: `<@${draft.ownerId}>`,
                inline: true
            },
            {
                name: "Channel",
                value: `<#${sentMessage.channelId}>`,
                inline: true
            },
            {
                name: "Message",
                value: `[Open Message](${sentMessage.url})`,
                inline: false
            }
        )
        .setTimestamp();

    await sendLog(
        channel.guild,
        LOG_CHANNELS.MSG,
        log
    );

    return sentMessage;
}

async function cacheScheduledImages(draft) {
    if (!draft.images.some(image => image.needsUpload && !image.localPath)) {
        return;
    }

    await fs.promises.mkdir(
        MESSAGE_UPLOAD_DIR,
        { recursive: true }
    );

    for (let index = 0; index < draft.images.length; index++) {
        const image = draft.images[index];
        if (!image.needsUpload || image.localPath) continue;

        const response = await fetch(image.url);
        if (!response.ok) {
            throw new Error(`Could not save picture ${index + 1} for scheduling.`);
        }

        const localPath = path.join(
            MESSAGE_UPLOAD_DIR,
            `scheduled-${draft.id}-${index + 1}.${fileExtension(image)}`
        );

        await fs.promises.writeFile(
            localPath,
            Buffer.from(await response.arrayBuffer())
        );

        image.localPath = localPath;
    }
}

async function processScheduledMessages() {
    const now = Date.now();

    for (const [draftId, storedDraft] of Object.entries(messageStore.scheduled)) {
        if (!storedDraft.scheduleAt || storedDraft.scheduleAt > now) continue;
        if (storedDraft.nextAttemptAt && storedDraft.nextAttemptAt > now) continue;

        try {
            await deliverMessageDraft(storedDraft);
            delete messageStore.scheduled[draftId];
            saveMessageStore();
        } catch (error) {
            console.error(
                `Scheduled message ${draftId} failed:`,
                error.message
            );

            storedDraft.attempts = (storedDraft.attempts || 0) + 1;
            storedDraft.nextAttemptAt = Date.now() + 5 * 60_000;

            if (storedDraft.attempts >= 3) {
                storedDraft.failed = true;
                storedDraft.nextAttemptAt = Date.now() + 24 * 60 * 60_000;
            }

            saveMessageStore();
        }
    }
}

function parseMessageReference(rawValue, explicitChannelId, fallbackChannelId) {
    const ids = String(rawValue || "").match(/\d{17,20}/g) || [];
    const messageId = ids.at(-1);
    const linkedChannelId = ids.length >= 2 ? ids.at(-2) : null;

    return {
        messageId,
        linkedChannelId,
        channelId:
            explicitChannelId ||
            linkedChannelId ||
            fallbackChannelId
    };
}

function isStaffMember(member) {
    return Boolean(
        member?.roles?.cache?.has(STAFF_ROLE_ID) ||
        member?.permissions?.has(
            PermissionsBitField.Flags.Administrator
        )
    );
}

async function syncTicketStaffPermissions(guild) {
    const ticketChannels =
        guild.channels.cache.filter(channel =>
            channel.type === ChannelType.GuildText &&
            channel.topic?.includes("sam-ticket-user:")
        );

    for (const [, channel] of ticketChannels) {
        await channel.permissionOverwrites.edit(
            STAFF_ROLE_ID,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            }
        ).catch(error => {
            console.error(
                `Could not update staff access for ${channel.name}:`,
                error.message
            );
        });

        if (
            LEGACY_STAFF_ROLE_ID &&
            LEGACY_STAFF_ROLE_ID !== STAFF_ROLE_ID
        ) {
            await channel.permissionOverwrites
                .delete(LEGACY_STAFF_ROLE_ID)
                .catch(() => {});
        }
    }

    console.log(
        `Ticket staff permissions synced for ${ticketChannels.size} channel(s) ✅`
    );
}

// ================= TIME PARSER =================
function parseDuration(durationStr) {
    const timeUnits = {
        m: 60000,
        h: 3600000,
        d: 86400000
    };

    const match = durationStr.match(/^(\d+)([mhd])$/i);

    if (!match) return null;

    return parseInt(match[1]) *
        timeUnits[match[2].toLowerCase()];
}

// ================= GET TICKET CATEGORY =================
async function getTicketCategory(guild, type) {

    const fallbackType = "script_support";

    const safeType =
        CATEGORY_NAMES[type]
            ? type
            : fallbackType;

    const configuredId =
        CATEGORY_IDS[safeType];

    // Try configured category ID
    if (configuredId) {

        const configuredCategory =
            guild.channels.cache.get(configuredId) ||
            await guild.channels
                .fetch(configuredId)
                .catch(() => null);

        if (
            configuredCategory &&
            configuredCategory.type === ChannelType.GuildCategory
        ) {
            return configuredCategory;
        }
    }

    const wantedName =
        CATEGORY_NAMES[safeType];

    // Find category by name
    let category =
        guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildCategory &&
            channel.name.toLowerCase() === wantedName.toLowerCase()
        );

    // Create category if not found
    if (!category) {

        category =
            await guild.channels.create({
                name: wantedName,
                type: ChannelType.GuildCategory
            });
    }

    CATEGORY_IDS[safeType] =
        category.id;

    return category;
}

// ================= CHECK OPEN TICKET =================
async function hasOpenTicket(
    guild,
    userId,
    type
) {

    const category =
        await getTicketCategory(
            guild,
            type
        );

    const member =
        guild.members.cache.get(userId);

    const username =
        member?.user?.username?.toLowerCase() || "";

    return guild.channels.cache.some(channel =>

        channel.type === ChannelType.GuildText &&

        channel.parentId === category.id &&

        !channel.name.startsWith("closed-") &&

        (
            channel.topic?.includes(
                `sam-ticket-user:${userId}`
            )

            ||

            (
                username &&
                channel.name
                    .toLowerCase()
                    .includes(username)
            )
        )
    );
}

// ================= GET TICKET CREATOR =================
async function getTicketCreator(channel) {

    const overwrites =
        channel.permissionOverwrites.cache;

    for (const [, overwrite] of overwrites) {

        if (
            overwrite.type === 1 &&
            overwrite.id !== STAFF_ROLE_ID &&
            overwrite.allow.has(
                PermissionsBitField.Flags.ViewChannel
            )
        ) {

            try {

                return await channel.guild.members.fetch(
                    overwrite.id
                );

            } catch (e) {}
        }
    }

    return null;
}

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Minutes")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove timeout")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear messages")
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Amount")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("msg")
        .setDescription("Open the SAM STUDIO message builder")
        .addStringOption(o =>
            o.setName("template")
                .setDescription("Optional ready-made message template")
                .setRequired(false)
                .addChoices(
                    { name: "Blank", value: "blank" },
                    { name: "Script Release", value: "script_release" },
                    { name: "Script Update", value: "update" },
                    { name: "Sale", value: "sale" },
                    { name: "Announcement", value: "announcement" },
                    { name: "Partnership", value: "partnership" }
                )
        ),

    new SlashCommandBuilder()
        .setName("editmsg")
        .setDescription("Edit a message sent by the SAM message builder")
        .addStringOption(o =>
            o.setName("message_id")
                .setDescription("Message ID or message link")
                .setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Message channel (optional)")
                .setRequired(false)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        ),

    new SlashCommandBuilder()
        .setName("copymsg")
        .setDescription("Duplicate a message sent by the SAM message builder")
        .addStringOption(o =>
            o.setName("message_id")
                .setDescription("Message ID or message link")
                .setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Original message channel (optional)")
                .setRequired(false)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        ),

    new SlashCommandBuilder()
        .setName("deletemsg")
        .setDescription("Delete a message sent by this bot")
        .addStringOption(o =>
            o.setName("message_id")
                .setDescription("Message ID or message link")
                .setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Message channel (optional)")
                .setRequired(false)
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        ),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Shows server information"),

    new SlashCommandBuilder()
        .setName("memberinfo")
        .setDescription("Shows member information")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("giverole")
        .setDescription("Give role to user or all")
        .addStringOption(o =>
            o.setName("roleid")
                .setDescription("Role ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("target")
                .setDescription("all or user mention/ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("removerole")
        .setDescription("Remove role from user or all")
        .addStringOption(o =>
            o.setName("roleid")
                .setDescription("Role ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("target")
                .setDescription("all or user mention/ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Start a giveaway")
        .addStringOption(o =>
            o.setName("prize")
                .setDescription("Prize for giveaway")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("duration")
                .setDescription("Duration (e.g. 1m, 2h, 1d)")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("winners")
                .setDescription("Number of winners")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Check user invites")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("antiping")
        .setDescription("Manage anti-ping")
        .addStringOption(o =>
            o.setName("action")
                .setDescription("add/remove/list")
                .setRequired(true)
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User to add/remove")
                .setRequired(false)
        ),

].map(cmd => cmd.toJSON());

// =====================================================
// BOT READY
// =====================================================

client.once(
    Events.ClientReady,
    async () => {

        console.log(
            `Logged in as ${client.user.tag}`
        );

        const rest =
            new REST({
                version: "10"
            }).setToken(TOKEN);

        try {

            await rest.put(
                Routes.applicationCommands(
                    CLIENT_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                "Slash Commands Registered ✅"
            );

        } catch (err) {

            console.error(err);
        }

        // Invite tracker setup

        const guild =
            client.guilds.cache.first();

        if (guild) {

            await syncTicketStaffPermissions(
                guild
            );

            try {

                const guildInvites =
                    await guild.invites.fetch();

                guildInvites.forEach(
                    invite =>
                        invites.set(
                            invite.code,
                            invite.uses
                        )
                );

                console.log(
                    "Invite Tracker Initialized ✅"
                );

            } catch (e) {}
        }

        await processScheduledMessages();

        setInterval(
            processScheduledMessages,
            30_000
        );

        setInterval(() => {
            const expiry = Date.now() - 30 * 60_000;

            for (const [draftId, draft] of messageDrafts) {
                if (draft.updatedAt < expiry) {
                    messageDrafts.delete(draftId);
                }
            }
        }, 5 * 60_000);
    }
);

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(
    "interactionCreate",
    async (interaction) => {

        try {

            // =================================================
            // SLASH COMMANDS
            // =================================================

            if (
                interaction.isChatInputCommand()
            ) {

                const cmd =
                    interaction.commandName;

                // ================= ANTI PING =================

                if (cmd === "antiping") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.Administrator
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "❌ Administrator permission required!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const action =
                        interaction.options.getString(
                            "action"
                        );

                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    if (
                        action === "add" &&
                        user
                    ) {

                        ANTI_PING_MEMBERS.add(
                            user.id
                        );

                        return interaction.reply({
                            content:
                                `✅ ${user.tag} added to anti-ping list.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        action === "remove" &&
                        user
                    ) {

                        ANTI_PING_MEMBERS.delete(
                            user.id
                        );

                        return interaction.reply({
                            content:
                                `✅ ${user.tag} removed from anti-ping list.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (action === "list") {

                        const list =
                            ANTI_PING_MEMBERS.size > 0

                                ? Array.from(
                                    ANTI_PING_MEMBERS
                                )
                                    .map(
                                        id =>
                                            `<@${id}>`
                                    )
                                    .join("\n")

                                : "Empty";

                        return interaction.reply({
                            content:
                                `**Anti-Ping Members:**\n${list}`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            "Invalid usage!",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // TICKET PANEL
                // =================================================

                if (cmd === "ticketpanel") {

                    if (
                        interaction.channelId !==
                        PANEL_CHANNEL_ID
                    ) {

                        return interaction.reply({
                            content:
                                "Wrong channel ♻️",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                "🎟️ Ticket & Support"
                            )

                            .setColor(
                                0x2b2d31
                            )

                            .setDescription(
                                TICKET_PANEL_DESCRIPTION
                            );

                    const select =
                        new StringSelectMenuBuilder()

                            .setCustomId(
                                "ticket_select"
                            )

                            .setPlaceholder(
                                "Select ticket type"
                            )

                            .addOptions(
                                Object.keys(TICKET_LABELS)
                                    .map(type => ({
                                        label:
                                            TICKET_LABELS[type],
                                        description:
                                            TICKET_DESCRIPTIONS[type],
                                        emoji:
                                            EMOJIS[type],
                                        value:
                                            type
                                    }))
                            );

                    return interaction.reply({

                        embeds: [
                            embed
                        ],

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    select
                                )
                        ]
                    });
                }

                // ================= INVITES =================

                if (cmd === "invites") {

                    const target =
                        interaction.options.getMember(
                            "user"
                        ) ||
                        interaction.member;

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                `📊 Invite Stats - ${target.user.tag}`
                            )

                            .setColor(
                                0x2b2d31
                            )

                            .setDescription(
                                "Invite tracking is active.\nFull detailed stats coming soon."
                            )

                            .setThumbnail(
                                target.user.displayAvatarURL({
                                    dynamic: true
                                })
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= GIVEAWAY =================

                if (cmd === "giveaway") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageGuild
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const prize =
                        interaction.options.getString(
                            "prize"
                        );

                    const durationStr =
                        interaction.options.getString(
                            "duration"
                        );

                    const winnersCount =
                        interaction.options.getInteger(
                            "winners"
                        );

                    const durationMs =
                        parseDuration(
                            durationStr
                        );

                    if (!durationMs) {

                        return interaction.reply({
                            content:
                                "❌ Invalid duration format! Use: 1m, 2h, 1d etc.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                "🎉 **GIVEAWAY** 🎉"
                            )

                            .setColor(
                                "#00FF00"
                            )

                            .setDescription(
                                `**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Ends in:** ${durationStr}`
                            )

                            .setFooter({
                                text:
                                    `Hosted by ${interaction.user.tag}`
                            })

                            .setTimestamp();

                    const msg =
                        await interaction.channel.send({
                            embeds: [
                                embed
                            ]
                        });

                    await msg.react(
                        "🎉"
                    );

                    const giveawayData = {

                        messageId:
                            msg.id,

                        channelId:
                            interaction.channel.id,

                        prize:
                            prize,

                        winners:
                            winnersCount,

                        endTime:
                            Date.now() +
                            durationMs
                    };

                    activeGiveaways.set(
                        msg.id,
                        giveawayData
                    );

                    setTimeout(
                        () =>
                            endGiveaway(
                                msg.id
                            ),
                        durationMs
                    );

                    return interaction.reply({
                        content:
                            "✅ Giveaway started!",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ================= BAN =================

                if (cmd === "ban") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.BanMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.ban({
                        reason
                    });

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FF0000"
                            )

                            .setTitle(
                                "Member Banned"
                            )

                            .addFields(

                                {
                                    name:
                                        "Target",
                                    value:
                                        target.user.tag
                                },

                                {
                                    name:
                                        "Moderator",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        reason
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                    return interaction.reply(
                        `✅ Banned ${target.user.tag}`
                    );
                }

                // ================= KICK =================

                if (cmd === "kick") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.KickMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.kick(
                        reason
                    );

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FFA500"
                            )

                            .setTitle(
                                "Member Kicked"
                            )

                            .addFields(

                                {
                                    name:
                                        "Target",
                                    value:
                                        target.user.tag
                                },

                                {
                                    name:
                                        "Moderator",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        reason
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                    return interaction.reply(
                        `✅ Kicked ${target.user.tag}`
                    );
                }

                // ================= MUTE =================

                if (cmd === "mute") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const minutes =
                        interaction.options.getInteger(
                            "minutes"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.timeout(
                        minutes * 60000,
                        reason
                    );

                    return interaction.reply(
                        `✅ ${target.user.tag} muted for ${minutes} minute(s).`
                    );
                }

                // ================= UNMUTE =================

                if (cmd === "unmute") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.timeout(
                        null
                    );

                    return interaction.reply(
                        `✅ Timeout removed from ${target.user.tag}`
                    );
                }

                // ================= WARN =================

                if (cmd === "warn") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getUser(
                            "user"
                        );

                    if (!warnings[target.id]) {

                        warnings[target.id] = 0;
                    }

                    warnings[target.id]++;

                    return interaction.reply(
                        `⚠️ ${target.tag} warned. Total warnings: ${warnings[target.id]}`
                    );
                }

                // ================= CLEAR =================

                if (cmd === "clear") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageMessages
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const amount =
                        interaction.options.getInteger(
                            "amount"
                        );

                    if (
                        amount < 1 ||
                        amount > 100
                    ) {

                        return interaction.reply({
                            content:
                                "Amount must be between 1 and 100.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.bulkDelete(
                        amount,
                        true
                    );

                    return interaction.reply({
                        content:
                            `✅ Deleted ${amount} messages.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ================= MSG =================

                if (["msg", "editmsg", "copymsg", "deletemsg"].includes(cmd)) {
                    if (!hasMessageBuilderPermission(interaction.member)) {
                        return interaction.reply({
                            content: "No Permission!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !LabelBuilder ||
                        !FileUploadBuilder ||
                        !ChannelSelectMenuBuilder ||
                        typeof ModalBuilder.prototype.addLabelComponents !== "function"
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Advanced message builder requires discord.js 14.27.0 or newer. Run: npm install discord.js@latest",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cmd === "msg") {
                        const templateName =
                            interaction.options.getString("template") ||
                            "blank";
                        const draft = createMessageDraft({
                            interaction,
                            templateName
                        });

                        return interaction.showModal(
                            buildMessageModal(draft)
                        );
                    }

                    const rawReference =
                        interaction.options.getString("message_id");
                    const chosenChannel =
                        interaction.options.getChannel("channel");
                    const reference = parseMessageReference(
                        rawReference,
                        chosenChannel?.id,
                        interaction.channelId
                    );

                    if (!reference.messageId) {
                        return interaction.reply({
                            content: "❌ Enter a valid message ID or message link.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cmd === "deletemsg") {
                        const savedRecord =
                            messageStore.messages[reference.messageId];
                        const deletionChannelId =
                            chosenChannel?.id ||
                            reference.linkedChannelId ||
                            savedRecord?.channelId ||
                            interaction.channelId;
                        const channel =
                            interaction.guild.channels.cache.get(deletionChannelId) ||
                            await interaction.guild.channels
                                .fetch(deletionChannelId)
                                .catch(() => null);
                        const message = channel?.isTextBased()
                            ? await channel.messages
                                .fetch(reference.messageId)
                                .catch(() => null)
                            : null;

                        if (!message || message.author.id !== client.user.id) {
                            return interaction.reply({
                                content: "❌ Bot message was not found in that channel.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        await message.delete();
                        delete messageStore.messages[reference.messageId];
                        saveMessageStore();

                        const log = new EmbedBuilder()
                            .setColor("#E74C3C")
                            .setTitle("Message Deleted")
                            .addFields(
                                {
                                    name: "Staff",
                                    value: `<@${interaction.user.id}>`,
                                    inline: true
                                },
                                {
                                    name: "Channel",
                                    value: `<#${deletionChannelId}>`,
                                    inline: true
                                },
                                {
                                    name: "Message ID",
                                    value: reference.messageId
                                }
                            )
                            .setTimestamp();

                        await sendLog(
                            interaction.guild,
                            LOG_CHANNELS.MSG,
                            log
                        );

                        return interaction.reply({
                            content: "✅ Message deleted.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const record = messageStore.messages[reference.messageId];
                    if (!record || record.guildId !== interaction.guildId) {
                        return interaction.reply({
                            content:
                                "❌ This message has no saved builder data. Only messages sent with the upgraded builder can be edited or copied.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const source = JSON.parse(JSON.stringify(record));
                    source.channelId =
                        cmd === "editmsg"
                            ? record.channelId
                            : chosenChannel?.id ||
                                reference.linkedChannelId ||
                                record.channelId;

                    const draft = createMessageDraft({
                        interaction,
                        source,
                        mode: cmd === "editmsg" ? "edit" : "new",
                        messageId:
                            cmd === "editmsg"
                                ? reference.messageId
                                : null
                    });

                    return interaction.showModal(
                        buildMessageModal(draft)
                    );
                }

                // ================= SERVER INFO =================

                if (cmd === "serverinfo") {

                    const guild =
                        interaction.guild;

                    const embed =
                        new EmbedBuilder()

                            .setColor(
                                0x2b2d31
                            )

                            .setTitle(
                                `${guild.name} Server Information`
                            )

                            .addFields(

                                {
                                    name:
                                        "Server Name",
                                    value:
                                        guild.name,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Members",
                                    value:
                                        `${guild.memberCount}`,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Server ID",
                                    value:
                                        guild.id,
                                    inline:
                                        false
                                },

                                {
                                    name:
                                        "Created",
                                    value:
                                        `<t:${Math.floor(
                                            guild.createdTimestamp /
                                            1000
                                        )}:F>`,
                                    inline:
                                        false
                                }
                            )

                            .setThumbnail(
                                guild.iconURL({
                                    dynamic: true
                                })
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= MEMBER INFO =================

                if (cmd === "memberinfo") {

                    const target =
                        interaction.options.getMember(
                            "user"
                        ) ||
                        interaction.member;

                    const embed =
                        new EmbedBuilder()

                            .setColor(
                                0x2b2d31
                            )

                            .setTitle(
                                `Member Info - ${target.user.tag}`
                            )

                            .setThumbnail(
                                target.user.displayAvatarURL({
                                    dynamic: true
                                })
                            )

                            .addFields(

                                {
                                    name:
                                        "User ID",
                                    value:
                                        target.id
                                },

                                {
                                    name:
                                        "Joined Server",
                                    value:
                                        target.joinedTimestamp
                                            ? `<t:${Math.floor(
                                                target.joinedTimestamp /
                                                1000
                                            )}:F>`
                                            : "Unknown"
                                },

                                {
                                    name:
                                        "Account Created",
                                    value:
                                        `<t:${Math.floor(
                                            target.user.createdTimestamp /
                                            1000
                                        )}:F>`
                                }
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= GIVE ROLE =================

                if (cmd === "giverole") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageRoles
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        interaction.options.getString(
                            "roleid"
                        );

                    const targetValue =
                        interaction.options.getString(
                            "target"
                        );

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {

                        return interaction.reply({
                            content:
                                "❌ Invalid Role ID.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        targetValue.toLowerCase() ===
                        "all"
                    ) {

                        const members =
                            await interaction.guild.members.fetch();

                        for (
                            const [, member]
                            of members
                        ) {

                            if (
                                member.user.bot
                            ) continue;

                            await member.roles
                                .add(role)
                                .catch(() => {});
                        }

                        return interaction.editReply(
                            `✅ Role ${role.name} given to all members.`
                        );
                    }

                    const userId =
                        targetValue.replace(
                            /[<@!>]/g,
                            ""
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(userId)
                            .catch(() => null);

                    if (!member) {

                        return interaction.editReply(
                            "❌ User not found."
                        );
                    }

                    await member.roles.add(
                        role
                    );

                    return interaction.editReply(
                        `✅ ${role.name} given to ${member.user.tag}.`
                    );
                }

                // ================= REMOVE ROLE =================

                if (cmd === "removerole") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageRoles
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        interaction.options.getString(
                            "roleid"
                        );

                    const targetValue =
                        interaction.options.getString(
                            "target"
                        );

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {

                        return interaction.reply({
                            content:
                                "❌ Invalid Role ID.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        targetValue.toLowerCase() ===
                        "all"
                    ) {

                        const members =
                            await interaction.guild.members.fetch();

                        for (
                            const [, member]
                            of members
                        ) {

                            if (
                                member.user.bot
                            ) continue;

                            await member.roles
                                .remove(role)
                                .catch(() => {});
                        }

                        return interaction.editReply(
                            `✅ Role ${role.name} removed from all members.`
                        );
                    }

                    const userId =
                        targetValue.replace(
                            /[<@!>]/g,
                            ""
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(userId)
                            .catch(() => null);

                    if (!member) {

                        return interaction.editReply(
                            "❌ User not found."
                        );
                    }

                    await member.roles.remove(
                        role
                    );

                    return interaction.editReply(
                        `✅ ${role.name} removed from ${member.user.tag}.`
                    );
                }
            }

            // =================================================
            // MODAL SUBMIT
            // =================================================

            if (
                interaction.isModalSubmit()
            ) {

                // ============ ADVANCED MSG MAIN FORM ============

                if (
                    interaction.customId.startsWith(
                        "msg_main_modal:"
                    )
                ) {
                    if (!hasMessageBuilderPermission(interaction.member)) {
                        return interaction.reply({
                            content: "No Permission!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const draftId = interaction.customId.split(":")[1];
                    const draft = getOwnedDraft(interaction, draftId);

                    if (!draft) {
                        return interaction.reply({
                            content: "❌ This message draft expired. Run /msg again.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const selectedChannels =
                        interaction.fields.getSelectedChannels("msg_channel");
                    const selectedChannel = selectedChannels?.first?.();

                    if (!selectedChannel) {
                        return interaction.reply({
                            content: "❌ Please select a destination channel.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (
                        draft.mode === "edit" &&
                        draft.originalChannelId &&
                        selectedChannel.id !== draft.originalChannelId
                    ) {
                        return interaction.reply({
                            content:
                                "❌ An existing message cannot be moved to another channel. Use Duplicate if you want to send a copy elsewhere.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const title = interaction.fields
                        .getTextInputValue("msg_title")
                        .trim();
                    const content = interaction.fields
                        .getTextInputValue("msg_content")
                        .trim();
                    const rawButtons = interaction.fields
                        .getTextInputValue("msg_buttons")
                        .trim();

                    let buttons;
                    try {
                        buttons = parseMessageButtons(rawButtons);
                    } catch (error) {
                        return interaction.reply({
                            content: `❌ ${error.message}`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    let uploadedImages = [];
                    try {
                        const uploaded =
                            interaction.fields.getUploadedFiles("msg_images");
                        uploadedImages = uploaded
                            ? Array.from(uploaded.values())
                            : [];
                    } catch (error) {
                        return interaction.reply({
                            content:
                                "❌ Picture upload requires discord.js 14.27.0 or newer.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const invalidImage = uploadedImages.find(image =>
                        !image.contentType?.startsWith("image/") &&
                        !/\.(png|jpe?g|gif|webp)$/i.test(image.name || "")
                    );

                    if (invalidImage) {
                        return interaction.reply({
                            content:
                                "❌ Only PNG, JPG, GIF, or WEBP pictures are allowed.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    draft.channelId = selectedChannel.id;
                    draft.title = title;
                    draft.content = content;
                    draft.buttons = buttons;

                    if (uploadedImages.length) {
                        draft.images = uploadedImages.map(image => ({
                            url: image.url,
                            name: image.name,
                            contentType: image.contentType || null,
                            needsUpload: true
                        }));
                        draft.clearExistingAttachments = true;
                    }

                    draft.updatedAt = Date.now();

                    try {
                        await getDraftChannel(draft);
                    } catch (error) {
                        return interaction.reply({
                            content: `❌ ${error.message}`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (
                        typeof interaction.isFromMessage === "function" &&
                        interaction.isFromMessage()
                    ) {
                        return interaction.update(
                            buildDraftPreview(draft, false)
                        );
                    }

                    return interaction.reply(
                        buildDraftPreview(draft, true)
                    );
                }

                // ========== ADVANCED MSG SETTINGS FORM ==========

                if (
                    interaction.customId.startsWith(
                        "msg_advanced_modal:"
                    )
                ) {
                    if (!hasMessageBuilderPermission(interaction.member)) {
                        return interaction.reply({
                            content: "No Permission!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const draftId = interaction.customId.split(":")[1];
                    const draft = getOwnedDraft(interaction, draftId);

                    if (!draft) {
                        return interaction.reply({
                            content: "❌ This message draft expired. Run /msg again.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    try {
                        draft.accentColor = parseAccentColor(
                            interaction.fields.getTextInputValue("msg_color")
                        );
                        draft.footer = interaction.fields
                            .getTextInputValue("msg_footer")
                            .trim();
                        draft.ping = parseMessagePing(
                            interaction.fields.getTextInputValue("msg_ping"),
                            interaction.guild
                        );
                        draft.reactions = parseMessageReactions(
                            interaction.fields.getTextInputValue("msg_reactions")
                        );
                        draft.scheduleAt = parseMessageSchedule(
                            interaction.fields.getTextInputValue("msg_schedule")
                        );
                    } catch (error) {
                        return interaction.reply({
                            content: `❌ ${error.message}`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    draft.updatedAt = Date.now();

                    if (
                        typeof interaction.isFromMessage === "function" &&
                        interaction.isFromMessage()
                    ) {
                        return interaction.update(
                            buildDraftPreview(draft, false)
                        );
                    }

                    return interaction.reply(
                        buildDraftPreview(draft, true)
                    );
                }


                // ================= TICKET MODAL =================

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const type =
                    interaction.customId.replace(
                        "modal_",
                        ""
                    );

                if (
                    await hasOpenTicket(
                        interaction.guild,
                        interaction.user.id,
                        type
                    )
                ) {

                    return interaction.editReply({
                        content:
                            "❌ You already have an open ticket for this category!"
                    });
                }

                const ticketCategory =
                    await getTicketCategory(
                        interaction.guild,
                        type
                    );

                // Clean username for channel
                const cleanUsername =
                    interaction.user.username
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9-_]/g,
                            "-"
                        )
                        .slice(
                            0,
                            40
                        );

                const ticketChannel =
                    await interaction.guild.channels.create({

                        name:
                            `${EMOJIS[type] || "🎫"}-${cleanUsername}`,

                        type:
                            ChannelType.GuildText,

                        parent:
                            ticketCategory.id,

                        topic:
                            `sam-ticket-type:${type}|sam-ticket-user:${interaction.user.id}`,

                        permissionOverwrites: [

                            {
                                id:
                                    interaction.guild.id,

                                deny: [
                                    PermissionsBitField.Flags.ViewChannel
                                ]
                            },

                            {
                                id:
                                    interaction.user.id,

                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    STAFF_ROLE_ID,

                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory,
                                    PermissionsBitField.Flags.AttachFiles,
                                    PermissionsBitField.Flags.EmbedLinks
                                ]
                            }
                        ]
                    });

                // ================= BUILD FORM FIELDS =================

                const fields = [];

                interaction.fields.fields.forEach(
                    f => {

                        fields.push({

                            name:
                                f.customId
                                    .toUpperCase()
                                    .replace(
                                        /_/g,
                                        " "
                                    ),

                            value:
                                `\`\`\`${f.value || "N/A"}\`\`\``
                        });
                    }
                );

                // ================= TICKET EMBED =================

                const embed =
                    new EmbedBuilder()

                        .setColor(
                            0x2b2d31
                        )

                        .setTitle(
                            `${EMOJIS[type] || "🎫"} ${TICKET_LABELS[type] || "Support"} Ticket`
                        )

                        .setDescription(
                            `Thank you for contacting **SAM STUDIO**.\nOur staff team will assist you shortly.`
                        )

                        .addFields(
                            fields
                        )

                        .setFooter({
                            text:
                                `Opened by ${interaction.user.tag} • SAM STUDIO`
                        })

                        .setTimestamp();

                // ================= BUTTONS =================

                const row =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId(
                                    "claim"
                                )
                                .setLabel(
                                    "Claim"
                                )
                                .setEmoji(
                                    "🙋"
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "close"
                                )
                                .setLabel(
                                    "Close"
                                )
                                .setEmoji(
                                    "🔒"
                                )
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                await ticketChannel.send({

                    content:
                        `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>\n\n**Your Ticket Is Opened, The SAM STUDIO Staff Team Will Assist You As Soon as Possible. Till Then Please Wait! <3**`,

                    embeds: [
                        embed
                    ],

                    components: [
                        row
                    ]
                });

                // ================= LOG =================

                const log =
                    new EmbedBuilder()

                        .setColor(
                            "#3498DB"
                        )

                        .setTitle(
                            "Ticket Created"
                        )

                        .addFields(

                            {
                                name:
                                    "User",
                                value:
                                    interaction.user.tag
                            },

                            {
                                name:
                                    "Channel",
                                value:
                                    `<#${ticketChannel.id}>`
                            },

                            {
                                name:
                                    "Type",
                                value:
                                    TICKET_LABELS[type] ||
                                    type.toUpperCase()
                            }
                        )

                        .setTimestamp();

                await sendLog(
                    interaction.guild,
                    LOG_CHANNELS.TICKET,
                    log
                );

                return interaction.editReply(
                    `✅ Ticket Created: ${ticketChannel}`
                );
            }

            // =================================================
            // TICKET SELECT MENU
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                "ticket_select"
            ) {

                const type =
                    interaction.values[0];

                const label =
                    TICKET_LABELS[type] ||
                    "Support";

                const modal =
                    new ModalBuilder()

                        .setCustomId(
                            `modal_${type}`
                        )

                        .setTitle(
                            `${EMOJIS[type] || "🎫"} ${label} Form`
                        );

                // =================================================
                // PRE-PURCHASE QUESTIONS
                // =================================================

                if (type === "pre_purchase") {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "help"
                                    )

                                    .setLabel(
                                        "What would you like to know?"
                                    )

                                    .setPlaceholder(
                                        "Enter your questions before purchasing..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                // =================================================
                // SCRIPT SUPPORT
                // =================================================

                else if (
                    type === "script_support"
                ) {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "script_issue"
                                    )

                                    .setLabel(
                                        "How can we help with the script?"
                                    )

                                    .setPlaceholder(
                                        "Explain the script issue in detail..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                // =================================================
                // PARTNERS
                // =================================================

                else if (
                    type === "partners"
                ) {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "partnership_details"
                                    )

                                    .setLabel(
                                        "Tell us about your partnership"
                                    )

                                    .setPlaceholder(
                                        "Share your community, project, and partnership details..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                else {
                    return interaction.reply({
                        content:
                            "❌ Invalid ticket category.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.showModal(
                    modal
                );
            }

            // =================================================
            // BUTTON HANDLER
            // =================================================

            if (
                interaction.isButton()
            ) {

                // ============== MSG PREVIEW BUTTONS ==============

                if (interaction.customId.startsWith("msg_")) {
                    if (!hasMessageBuilderPermission(interaction.member)) {
                        return interaction.reply({
                            content: "No Permission!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const separatorIndex = interaction.customId.indexOf(":");
                    const action = separatorIndex === -1
                        ? interaction.customId
                        : interaction.customId.slice(0, separatorIndex);
                    const draftId = separatorIndex === -1
                        ? ""
                        : interaction.customId.slice(separatorIndex + 1);
                    const draft = getOwnedDraft(interaction, draftId);

                    if (!draft) {
                        return interaction.reply({
                            content: "❌ This message draft expired. Run /msg again.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === "msg_edit") {
                        return interaction.showModal(
                            buildMessageModal(draft)
                        );
                    }

                    if (action === "msg_advanced") {
                        return interaction.showModal(
                            buildAdvancedMessageModal(draft)
                        );
                    }

                    if (action === "msg_copy") {
                        const copiedSource = JSON.parse(JSON.stringify(draft));
                        copiedSource.scheduleAt = null;

                        const copiedDraft = createMessageDraft({
                            interaction,
                            source: copiedSource,
                            mode: "new",
                            messageId: null
                        });

                        return interaction.showModal(
                            buildMessageModal(copiedDraft)
                        );
                    }

                    if (action === "msg_clear_images") {
                        draft.images = [];
                        draft.clearExistingAttachments = true;
                        draft.updatedAt = Date.now();

                        return interaction.update(
                            buildDraftPreview(draft, false)
                        );
                    }

                    if (action === "msg_cancel") {
                        messageDrafts.delete(draft.id);

                        return interaction.update({
                            components: [
                                new TextDisplayBuilder().setContent(
                                    "❌ Message draft cancelled. Nothing was sent."
                                )
                            ]
                        });
                    }

                    if (action === "msg_send") {
                        await interaction.deferUpdate();

                        try {
                            if (draft.scheduleAt) {
                                await cacheScheduledImages(draft);

                                messageStore.scheduled[draft.id] =
                                    JSON.parse(JSON.stringify(draft));
                                saveMessageStore();
                                messageDrafts.delete(draft.id);

                                return interaction.editReply({
                                    components: [
                                        new TextDisplayBuilder().setContent(
                                            `✅ Message scheduled for <t:${Math.floor(draft.scheduleAt / 1000)}:F> in <#${draft.channelId}>.`
                                        )
                                    ]
                                });
                            }

                            const sentMessage =
                                await deliverMessageDraft(draft);
                            messageDrafts.delete(draft.id);

                            return interaction.editReply({
                                components: [
                                    new TextDisplayBuilder().setContent(
                                        `✅ Message ${draft.mode === "edit" ? "updated" : "sent"} in <#${sentMessage.channelId}>. [Open Message](${sentMessage.url})`
                                    )
                                ]
                            });
                        } catch (error) {
                            console.error(
                                "SAM message delivery failed:",
                                error
                            );

                            return interaction.editReply({
                                components: [
                                    new TextDisplayBuilder().setContent(
                                        `❌ ${error.message || "Message could not be sent."}`
                                    ),
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`msg_edit:${draft.id}`)
                                            .setLabel("Back to Edit")
                                            .setEmoji("✏️")
                                            .setStyle(ButtonStyle.Primary),
                                        new ButtonBuilder()
                                            .setCustomId(`msg_cancel:${draft.id}`)
                                            .setLabel("Cancel")
                                            .setStyle(ButtonStyle.Danger)
                                    )
                                ]
                            });
                        }
                    }
                }

                // =================================================
                // CLAIM
                // =================================================

                if (
                    interaction.customId ===
                    "claim"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#2ECC71"
                            )

                            .setTitle(
                                "Ticket Claimed"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Staff Member",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    return interaction.editReply(
                        `✅ Ticket claimed by <@${interaction.user.id}>`
                    );
                }

                // =================================================
                // CLOSE
                // =================================================

                if (
                    interaction.customId ===
                    "close"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const creator =
                        await getTicketCreator(
                            interaction.channel
                        );

                    // ================= TRANSCRIPT =================

                    if (creator) {

                        try {

                            const messages =
                                await interaction.channel.messages.fetch({
                                    limit:
                                        100
                                });

                            let transcript =
                                `SAM STUDIO Ticket Transcript\n` +
                                `Ticket: ${interaction.channel.name}\n` +
                                `Generated: ${new Date().toLocaleString()}\n\n`;

                            messages
                                .reverse()
                                .forEach(
                                    m => {

                                        transcript +=
                                            `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
                                    }
                                );

                            const buffer =
                                Buffer.from(
                                    transcript,
                                    "utf-8"
                                );

                            await creator.send({

                                content:
                                    `📄 **Your SAM STUDIO Ticket Transcript** - ${interaction.channel.name}`,

                                files: [
                                    {
                                        attachment:
                                            buffer,

                                        name:
                                            `transcript-${interaction.channel.name}.txt`
                                    }
                                ]
                            });

                        } catch (e) {

                            console.log(
                                "Unable to DM transcript."
                            );
                        }
                    }

                    // Move to closed category

                    await interaction.channel
                        .setParent(
                            CLOSED_CATEGORY_ID
                        )
                        .catch(() => {});

                    // Prevent double closed-
                    if (
                        !interaction.channel.name.startsWith(
                            "closed-"
                        )
                    ) {

                        await interaction.channel.setName(
                            `closed-${interaction.channel.name}`
                        );
                    }

                    // ================= CLOSE LOG =================

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#E74C3C"
                            )

                            .setTitle(
                                "Ticket Closed"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Closed By",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    // ================= REOPEN / DELETE =================

                    const reopenRow =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        "reopen"
                                    )
                                    .setLabel(
                                        "Reopen"
                                    )
                                    .setEmoji(
                                        "🔓"
                                    )
                                    .setStyle(
                                        ButtonStyle.Success
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        "delete"
                                    )
                                    .setLabel(
                                        "Delete"
                                    )
                                    .setEmoji(
                                        "🗑️"
                                    )
                                    .setStyle(
                                        ButtonStyle.Danger
                                    )
                            );

                    return interaction.editReply({

                        content:
                            "Ticket Closed. ✅ Transcript sent to opener's DM.",

                        components: [
                            reopenRow
                        ]
                    });
                }

                // =================================================
                // REOPEN
                // =================================================

                if (
                    interaction.customId ===
                    "reopen"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const originalName =
                        interaction.channel.name.replace(
                            "closed-",
                            ""
                        );

                    // Find original ticket type from channel topic

                    const typeMatch =
                        interaction.channel.topic?.match(
                            /sam-ticket-type:([^|]+)/
                        );

                    const originalType =
                        typeMatch?.[1] ||
                        "script_support";

                    const originalCategory =
                        await getTicketCategory(
                            interaction.guild,
                            originalType
                        );

                    await interaction.channel.setName(
                        originalName
                    );

                    // Restore to EXACT original category

                    await interaction.channel
                        .setParent(
                            originalCategory.id
                        )
                        .catch(() => {});

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#2ECC71"
                            )

                            .setTitle(
                                "Ticket Reopened"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Reopened By",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Ticket Type",
                                    value:
                                        TICKET_LABELS[
                                            originalType
                                        ] ||
                                        originalType
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    return interaction.editReply(
                        "✅ Ticket Reopened!"
                    );
                }

                // =================================================
                // DELETE
                // =================================================

                if (
                    interaction.customId ===
                    "delete"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    // ================= TRANSCRIPT =================

                    const messages =
                        await interaction.channel.messages.fetch({
                            limit:
                                100
                        });

                    let transcript =
                        `SAM STUDIO Ticket Transcript\n` +
                        `Ticket: ${interaction.channel.name}\n` +
                        `Generated: ${new Date().toLocaleString()}\n\n`;

                    messages
                        .reverse()
                        .forEach(
                            m => {

                                transcript +=
                                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
                            }
                        );

                    const buffer =
                        Buffer.from(
                            transcript,
                            "utf-8"
                        );

                    // ================= DELETE LOG =================

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#000000"
                            )

                            .setTitle(
                                "Ticket Deleted"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Deleted By",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    const ticketLogChan =
                        interaction.guild.channels.cache.get(
                            LOG_CHANNELS.TICKET
                        );

                    if (ticketLogChan) {

                        await ticketLogChan.send({

                            embeds: [
                                log
                            ],

                            files: [
                                {
                                    attachment:
                                        buffer,

                                    name:
                                        `transcript-${interaction.channel.id}.txt`
                                }
                            ]
                        });
                    }

                    return interaction.channel.delete();
                }
            }

        } catch (err) {

            console.error(err);

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {

                interaction.reply({
                    content:
                        "❌ Something went wrong!",
                    flags:
                        MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
);

// =====================================================
// ANTI-PING + SPAM PROTECTION
// =====================================================

client.on(
    Events.MessageCreate,
    async (message) => {

        if (
            message.author.bot
        ) return;

        // ================= AUTO MESSAGE =================

        if (
            message.content.toLowerCase() ===
            "!automsg"
        ) {

            const autoEmbed =
                new EmbedBuilder()

                    .setTitle(
                        "Welcome to SAM STUDIO"
                    )

                    .setDescription(
                        "Enjoy your stay! Follow the rules and have fun."
                    )

                    .setColor(
                        0x2b2d31
                    );

            return message.channel.send({
                embeds: [
                    autoEmbed
                ]
            });
        }

        let shouldBlock =
            false;

        // Check member mentions

        message.mentions.members.forEach(
            member => {

                if (
                    ANTI_PING_MEMBERS.has(
                        member.id
                    )
                ) {

                    shouldBlock =
                        true;
                }
            }
        );

        // Check protected role

        if (
            message.mentions.roles.has(
                ANTI_PING_ROLE_ID
            )
        ) {

            shouldBlock =
                true;
        }

        if (shouldBlock) {

            const userId =
                message.author.id;

            const now =
                Date.now();

            if (
                !antiPingAttempts.has(
                    userId
                )
            ) {

                antiPingAttempts.set(
                    userId,
                    {
                        count:
                            0,

                        timestamp:
                            now
                    }
                );
            }

            const data =
                antiPingAttempts.get(
                    userId
                );

            if (
                now -
                data.timestamp >
                60000
            ) {

                data.count =
                    0;

                data.timestamp =
                    now;
            }

            data.count +=
                1;

            await message.delete()
                .catch(() => {});

            // 3rd attempt = timeout

            if (
                data.count >= 3
            ) {

                try {

                    await message.member.timeout(
                        10 * 60000,
                        "Anti-Ping Spam"
                    );

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FF0000"
                            )

                            .setTitle(
                                "Anti-Ping Timeout"
                            )

                            .addFields(

                                {
                                    name:
                                        "User",
                                    value:
                                        message.author.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        "Protected member ping spam"
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        message.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                } catch (e) {}

                antiPingAttempts.delete(
                    userId
                );

            } else {

                const remaining =
                    3 -
                    data.count;

                await message.channel.send({

                    content:
                        `${message.author}`,

                    embeds: [

                        new EmbedBuilder()

                            .setColor(
                                "#FFA500"
                            )

                            .setDescription(
                                `🚫 Protected staff ko ping mat karo!\n${remaining} try baaki. 3rd try par 10 min timeout.`
                            )
                    ]

                }).then(
                    msg =>
                        setTimeout(
                            () =>
                                msg.delete()
                                    .catch(
                                        () => {}
                                    ),
                            8000
                        )
                );
            }

            return;
        }
    }
);

// =====================================================
// MESSAGE DELETE LOG
// =====================================================

client.on(
    Events.MessageDelete,
    async (message) => {

        if (
            message.author?.bot ||
            !LOG_CHANNELS.MSG
        ) return;

        const embed =
            new EmbedBuilder()

                .setColor(
                    "#FF0000"
                )

                .setTitle(
                    "Message Deleted"
                )

                .addFields(

                    {
                        name:
                            "Author",
                        value:
                            `${message.author.tag}`
                    },

                    {
                        name:
                            "Channel",
                        value:
                            `<#${message.channel.id}>`
                    },

                    {
                        name:
                            "Content",
                        value:
                            message.content?.slice(
                                0,
                                1000
                            ) ||
                            "No Content"
                    }
                )

                .setTimestamp();

        await sendLog(
            message.guild,
            LOG_CHANNELS.MSG,
            embed
        );
    }
);

// =====================================================
// MESSAGE UPDATE LOG
// =====================================================

client.on(
    Events.MessageUpdate,
    async (
        oldMessage,
        newMessage
    ) => {

        if (
            oldMessage.author?.bot ||
            !LOG_CHANNELS.MSG
        ) return;

        if (
            oldMessage.content ===
            newMessage.content
        ) return;

        const embed =
            new EmbedBuilder()

                .setColor(
                    "#FFA500"
                )

                .setTitle(
                    "Message Edited"
                )

                .addFields(

                    {
                        name:
                            "Author",
                        value:
                            `${oldMessage.author.tag}`
                    },

                    {
                        name:
                            "Channel",
                        value:
                            `<#${oldMessage.channel.id}>`
                    },

                    {
                        name:
                            "Before",
                        value:
                            oldMessage.content?.slice(
                                0,
                                500
                            ) ||
                            "No Content"
                    },

                    {
                        name:
                            "After",
                        value:
                            newMessage.content?.slice(
                                0,
                                500
                            ) ||
                            "No Content"
                    }
                )

                .setTimestamp();

        await sendLog(
            oldMessage.guild,
            LOG_CHANNELS.MSG,
            embed
        );
    }
);

// =====================================================
// VOICE CHANNEL LOG
// =====================================================

client.on(
    Events.VoiceStateUpdate,
    async (
        oldState,
        newState
    ) => {

        if (
            !LOG_CHANNELS.VC
        ) return;

        const member =
            newState.member;

        if (
            oldState.channelId !==
            newState.channelId
        ) {

            let action =
                "";

            if (
                !oldState.channelId
            ) {

                action =
                    "Joined VC";

            } else if (
                !newState.channelId
            ) {

                action =
                    "Left VC";

            } else {

                action =
                    "Switched VC";
            }

            const embed =
                new EmbedBuilder()

                    .setColor(
                        "#00FFFF"
                    )

                    .setTitle(
                        "Voice Channel Update"
                    )

                    .addFields(

                        {
                            name:
                                "Member",
                            value:
                                member.user.tag
                        },

                        {
                            name:
                                "Action",
                            value:
                                action
                        }
                    )

                    .setTimestamp();

            await sendLog(
                newState.guild,
                LOG_CHANNELS.VC,
                embed
            );
        }
    }
);

// =====================================================
// MEMBER UPDATE
// ROLE + NICKNAME LOGS
// =====================================================

client.on(
    Events.GuildMemberUpdate,
    async (
        oldMember,
        newMember
    ) => {

        // ================= ROLE LOGS =================

        if (
            LOG_CHANNELS.ROLE
        ) {

            const oldRoles =
                oldMember.roles.cache;

            const newRoles =
                newMember.roles.cache;

            const added =
                newRoles.filter(
                    r =>
                        !oldRoles.has(
                            r.id
                        )
                );

            const removed =
                oldRoles.filter(
                    r =>
                        !newRoles.has(
                            r.id
                        )
                );

            if (
                added.size ||
                removed.size
            ) {

                const embed =
                    new EmbedBuilder()

                        .setColor(
                            "#9B59B6"
                        )

                        .setTitle(
                            "Role Updated"
                        )

                        .addFields(

                            {
                                name:
                                    "Member",
                                value:
                                    newMember.user.tag
                            },

                            {
                                name:
                                    "Added",
                                value:
                                    added.size
                                        ? added
                                            .map(
                                                r =>
                                                    r.name
                                            )
                                            .join(
                                                ", "
                                            )
                                        : "None"
                            },

                            {
                                name:
                                    "Removed",
                                value:
                                    removed.size
                                        ? removed
                                            .map(
                                                r =>
                                                    r.name
                                            )
                                            .join(
                                                ", "
                                            )
                                        : "None"
                            }
                        )

                        .setTimestamp();

                await sendLog(
                    newMember.guild,
                    LOG_CHANNELS.ROLE,
                    embed
                );
            }
        }

        // ================= NICKNAME LOGS =================

        if (
            LOG_CHANNELS.NICKNAME &&
            oldMember.nickname !==
            newMember.nickname
        ) {

            const embed =
                new EmbedBuilder()

                    .setColor(
                        "#F1C40F"
                    )

                    .setTitle(
                        "Nickname Changed"
                    )

                    .addFields(

                        {
                            name:
                                "Member",
                            value:
                                newMember.user.tag
                        },

                        {
                            name:
                                "Old",
                            value:
                                oldMember.nickname ||
                                "None"
                        },

                        {
                            name:
                                "New",
                            value:
                                newMember.nickname ||
                                "None"
                        }
                    )

                    .setTimestamp();

            await sendLog(
                newMember.guild,
                LOG_CHANNELS.NICKNAME,
                embed
            );
        }
    }
);

// =====================================================
// MEMBER JOIN
// =====================================================

client.on(
    Events.GuildMemberAdd,
    async (member) => {

        console.log(
            `[DEBUG] New member joined: ${member.user.tag} (${member.id})`
        );

        // ================= VERIFIED ROLE =================

        if (
            VERIFIED_ROLE_ID
        ) {

            await member.roles
                .add(
                    VERIFIED_ROLE_ID
                )
                .catch(
                    () => {}
                );
        }

        // ================= WELCOME =================

        if (
            WELCOME_CHANNEL_ID
        ) {

            const channel =
                member.guild.channels.cache.get(
                    WELCOME_CHANNEL_ID
                );

            if (channel) {

                const payload = {
                    content:
                        `Welcome ${member} to **SAM STUDIO**!`,
                    allowedMentions: {
                        parse: [],
                        users: [
                            member.id
                        ],
                        roles: []
                    }
                };

                try {

                    const welcomeBuffer =
                        await makeWelcomeImage(
                            member
                        );

                    const imageName =
                        `sam-welcome-${member.id}.png`;

                    const welcomeFile =
                        new AttachmentBuilder(
                            welcomeBuffer,
                            {
                                name:
                                    imageName
                            }
                        );

                    payload.files = [
                        welcomeFile
                    ];

                } catch (error) {

                    console.error(
                        `[WELCOME] Could not render image for ${member.user.tag}:`,
                        error
                    );

                }

                await channel.send(
                    payload
                ).catch(error => {
                    console.error(
                        "[WELCOME] Could not send welcome message:",
                        error
                    );
                });
            }
        }

        // ================= INVITE TRACKER =================

        if (
            LOG_CHANNELS.INVITE
        ) {

            try {

                const guildInvites =
                    await member.guild.invites.fetch();

                let usedInvite =
                    null;

                let inviter =
                    null;

                guildInvites.forEach(
                    invite => {

                        const oldUses =
                            invites.get(
                                invite.code
                            ) || 0;

                        if (
                            invite.uses >
                            oldUses
                        ) {

                            usedInvite =
                                invite;

                            inviter =
                                invite.inviter;
                        }
                    }
                );

                if (usedInvite) {

                    invites.set(
                        usedInvite.code,
                        usedInvite.uses
                    );

                    const logEmbed =
                        new EmbedBuilder()

                            .setTitle(
                                "📨 New Member via Invite"
                            )

                            .setColor(
                                "#00FF00"
                            )

                            .addFields(

                                {
                                    name:
                                        "Member",
                                    value:
                                        `${member.user.tag} (${member.id})`
                                },

                                {
                                    name:
                                        "Inviter",
                                    value:
                                        inviter
                                            ? `${inviter.tag}`
                                            : "Unknown"
                                },

                                {
                                    name:
                                        "Invite Code",
                                    value:
                                        usedInvite.code
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        member.guild,
                        LOG_CHANNELS.INVITE,
                        logEmbed
                    );
                }

            } catch (e) {}
        }
    }
);

// =====================================================
// MEMBER LEAVE
// =====================================================

client.on(
    Events.GuildMemberRemove,
    async (member) => {

        if (
            GOODBYE_CHANNEL_ID
        ) {

            const channel =
                member.guild.channels.cache.get(
                    GOODBYE_CHANNEL_ID
                );

            if (channel) {

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "Goodbye"
                        )

                        .setDescription(
                            `${member.user.tag} left the server.`
                        )

                        .setColor(
                            "#FF0000"
                        );

                channel.send({
                    embeds: [
                        embed
                    ]
                });
            }
        }
    }
);

// =====================================================
// GIVEAWAY END FUNCTION
// =====================================================

async function endGiveaway(
    messageId
) {

    const giveaway =
        activeGiveaways.get(
            messageId
        );

    if (!giveaway) return;

    const channel =
        client.channels.cache.get(
            giveaway.channelId
        );

    if (!channel) return;

    try {

        const msg =
            await channel.messages.fetch(
                messageId
            );

        const reactions =
            msg.reactions.cache.get(
                "🎉"
            );

        if (!reactions) {

            activeGiveaways.delete(
                messageId
            );

            return channel.send(
                "❌ No one participated in the giveaway."
            );
        }

        const users =
            await reactions.users.fetch();

        let participants =
            users
                .filter(
                    u =>
                        !u.bot
                )
                .map(
                    u =>
                        u.id
                );

        if (
            participants.length ===
            0
        ) {

            activeGiveaways.delete(
                messageId
            );

            return channel.send(
                "❌ No one participated in the giveaway."
            );
        }

        let winners =
            [];

        for (
            let i = 0;
            i < giveaway.winners;
            i++
        ) {

            if (
                participants.length ===
                0
            ) break;

            const winnerId =
                participants.splice(
                    Math.floor(
                        Math.random() *
                        participants.length
                    ),
                    1
                )[0];

            winners.push(
                `<@${winnerId}>`
            );
        }

        const embed =
            new EmbedBuilder()

                .setTitle(
                    "🎉 Giveaway Ended!"
                )

                .setColor(
                    "#FF0000"
                )

                .setDescription(
                    `**Prize:** ${giveaway.prize}\n**Winners:** ${winners.join(", ")}`
                );

        channel.send({
            embeds: [
                embed
            ]
        });

    } catch (e) {

        console.log(
            "Giveaway error"
        );
    }

    activeGiveaways.delete(
        messageId
    );
}

// =====================================================
// START BOT
// =====================================================

console.log(
    "SAM STUDIO Bot is ready with All Logs + Premium Ticket Panel + Advanced Anti-Ping + Invite Tracker!"
);

client.login(
    TOKEN
).catch(
    console.error
);
