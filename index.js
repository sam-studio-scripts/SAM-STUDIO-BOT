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
    AttachmentBuilder,
    AuditLogEvent
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
const BOT_STATE_FILE = path.join(__dirname, "sam_bot_state.json");

function loadBotState() {
    try {
        if (!fs.existsSync(BOT_STATE_FILE)) {
            return {
                warnings: {},
                protections: {
                    antiPingMembers: [],
                    antiSpamChannels: [],
                    antiLinkChannels: [],
                    antiMentionChannels: []
                },
                giveaways: {},
                inviteStats: {},
                memberInviters: {}
            };
        }

        const parsed = JSON.parse(fs.readFileSync(BOT_STATE_FILE, "utf8"));
        return {
            warnings: parsed.warnings && typeof parsed.warnings === "object" ? parsed.warnings : {},
            protections: parsed.protections && typeof parsed.protections === "object"
                ? parsed.protections
                : {},
            giveaways: parsed.giveaways && typeof parsed.giveaways === "object" ? parsed.giveaways : {},
            inviteStats: parsed.inviteStats && typeof parsed.inviteStats === "object" ? parsed.inviteStats : {},
            memberInviters: parsed.memberInviters && typeof parsed.memberInviters === "object" ? parsed.memberInviters : {}
        };
    } catch (error) {
        console.error("Could not load SAM bot state:", error.message);
        return { warnings: {}, protections: {}, giveaways: {}, inviteStats: {}, memberInviters: {} };
    }
}

const botState = loadBotState();
let warnings = botState.warnings || {};
let antiSpamChannels = new Set(botState.protections?.antiSpamChannels || []);
let antiLinkChannels = new Set(botState.protections?.antiLinkChannels || []);
let antiMentionChannels = new Set(botState.protections?.antiMentionChannels || []);
let activeGiveaways = new Map(Object.entries(botState.giveaways || {}));
let invites = new Map();
let inviteStats = botState.inviteStats || {};
let memberInviters = botState.memberInviters || {};

const spamTracker = new Map();
const protectionViolations = new Map();

const SPAM_LIMIT = Math.max(3, Number(process.env.SPAM_LIMIT || 6));
const SPAM_WINDOW_MS = Math.max(3000, Number(process.env.SPAM_WINDOW_MS || 7000));
const SPAM_TIMEOUT_MS = Math.max(60000, Number(process.env.SPAM_TIMEOUT_MS || 300000));
const MENTION_LIMIT = Math.max(3, Number(process.env.MENTION_LIMIT || 5));

function saveBotState() {
    try {
        botState.warnings = warnings;
        botState.protections = {
            antiPingMembers: Array.from(ANTI_PING_MEMBERS || []),
            antiSpamChannels: Array.from(antiSpamChannels),
            antiLinkChannels: Array.from(antiLinkChannels),
            antiMentionChannels: Array.from(antiMentionChannels)
        };
        botState.giveaways = Object.fromEntries(activeGiveaways);
        botState.inviteStats = inviteStats;
        botState.memberInviters = memberInviters;

        const tempFile = `${BOT_STATE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(botState, null, 2), "utf8");
        fs.renameSync(tempFile, BOT_STATE_FILE);
    } catch (error) {
        console.error("Could not save SAM bot state:", error.message);
    }
}

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
        const tempFile = `${MESSAGE_STORE_FILE}.tmp`;
        fs.writeFileSync(
            tempFile,
            JSON.stringify(messageStore, null, 2),
            "utf8"
        );
        fs.renameSync(tempFile, MESSAGE_STORE_FILE);
    } catch (error) {
        console.error(
            "Could not save SAM message data:",
            error.message
        );
    }
}

// ================= ANTI PING =================
const ANTI_PING_MEMBERS = new Set(botState.protections?.antiPingMembers || []);
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
        Partials.User,
        Partials.Message
    ],
});

// ================= HELPER =================
async function sendLog(guild, channelId, embed, extra = {}) {
    if (!guild || !channelId) return null;

    const channel =
        guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
        return null;
    }

    return channel.send({
        embeds: [embed],
        ...extra
    }).catch(error => {
        console.error(`[LOG] Could not send log to ${channelId}:`, error.message);
        return null;
    });
}

function trimText(value, max = 1024) {
    const text = String(value ?? "").trim();
    if (!text) return "None";
    return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function userLabel(user) {
    if (!user) return "Unknown";
    return `<@${user.id}>\n\`${user.tag || user.username || user.id}\` • \`${user.id}\``;
}

function makeLogEmbed({ title, color = 0x2b2d31, emoji = "📋", description = null, user = null, footer = "SAM STUDIO • Security & Activity Logs" }) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${title}`)
        .setTimestamp()
        .setFooter({ text: footer });

    if (description) embed.setDescription(description);
    if (user?.displayAvatarURL) {
        embed.setThumbnail(user.displayAvatarURL({ extension: "png", size: 256, forceStatic: false }));
    }

    return embed;
}

function formatChannel(channel) {
    return channel ? `<#${channel.id}>\n\`${channel.name || channel.id}\` • \`${channel.id}\`` : "None";
}

function hasHigherRole(actorMember, targetMember) {
    if (!actorMember || !targetMember) return false;
    if (actorMember.guild.ownerId === actorMember.id) return true;
    return actorMember.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
}

function moderationTargetError(interaction, target, actionName = "moderate") {
    if (!target) return "❌ User not found in this server.";
    if (target.id === interaction.user.id) return `❌ You cannot ${actionName} yourself.`;
    if (target.id === interaction.guild.ownerId) return `❌ The server owner cannot be targeted with ${actionName}.`;
    if (!hasHigherRole(interaction.member, target)) {
        return "❌ Your highest role must be above the target member's highest role.";
    }

    const me = interaction.guild.members.me;
    if (!me || me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
        return "❌ My bot role must be above the target member's highest role.";
    }

    return null;
}

async function getRecentAuditExecutor(guild, type, targetId) {
    if (!guild?.members?.me?.permissions?.has(PermissionsBitField.Flags.ViewAuditLog)) return null;

    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 6 });
        const now = Date.now();
        const entry = logs.entries.find(item =>
            item.target?.id === targetId &&
            Math.abs(now - item.createdTimestamp) < 10_000
        );
        return entry?.executor || null;
    } catch (error) {
        return null;
    }
}

function getTicketMeta(channel) {
    const topic = channel?.topic || "";
    return {
        type: topic.match(/sam-ticket-type:([^|]+)/)?.[1] || "script_support",
        userId: topic.match(/sam-ticket-user:(\d{17,20})/)?.[1] || null,
        claimedBy: topic.match(/sam-ticket-claimed:(\d{17,20})/)?.[1] || null,
        panelMessageId: topic.match(/sam-ticket-panel:(\d{17,20})/)?.[1] || null
    };
}

async function setTicketMeta(channel, updates = {}) {
    const meta = { ...getTicketMeta(channel), ...updates };
    const parts = [
        `sam-ticket-type:${meta.type || "script_support"}`,
        meta.userId ? `sam-ticket-user:${meta.userId}` : null,
        meta.claimedBy ? `sam-ticket-claimed:${meta.claimedBy}` : null,
        meta.panelMessageId ? `sam-ticket-panel:${meta.panelMessageId}` : null
    ].filter(Boolean);

    await channel.setTopic(parts.join("|"));
    return meta;
}

function openTicketButtons(claimedBy = null) {
    const claim = new ButtonBuilder()
        .setCustomId("claim")
        .setLabel(claimedBy ? "Claimed" : "Claim")
        .setEmoji(claimedBy ? "✅" : "🙋")
        .setStyle(claimedBy ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(Boolean(claimedBy));

    return new ActionRowBuilder().addComponents(
        claim,
        new ButtonBuilder()
            .setCustomId("close")
            .setLabel("Close")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
    );
}

function closedTicketButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("reopen")
            .setLabel("Reopen")
            .setEmoji("🔓")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("delete")
            .setLabel("Delete")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Danger)
    );
}

async function fetchAllChannelMessages(channel, maxMessages = 1000) {
    const collected = [];
    let before;

    while (collected.length < maxMessages) {
        const batch = await channel.messages.fetch({
            limit: Math.min(100, maxMessages - collected.length),
            ...(before ? { before } : {})
        });

        if (!batch.size) break;
        const values = Array.from(batch.values());
        collected.push(...values);
        before = values[values.length - 1].id;
        if (batch.size < 100) break;
    }

    return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function makeTicketTranscript(channel) {
    const meta = getTicketMeta(channel);
    const messages = await fetchAllChannelMessages(channel);
    const lines = [
        "SAM STUDIO Ticket Transcript",
        `Ticket: ${channel.name}`,
        `Channel ID: ${channel.id}`,
        `Ticket Type: ${TICKET_LABELS[meta.type] || meta.type}`,
        `Opened By User ID: ${meta.userId || "Unknown"}`,
        `Claimed By User ID: ${meta.claimedBy || "Not claimed"}`,
        `Generated: ${new Date().toISOString()}`,
        "",
        "============================================================",
        ""
    ];

    for (const message of messages) {
        lines.push(`[${message.createdAt.toISOString()}] ${message.author?.tag || "Unknown"} (${message.author?.id || "Unknown"})`);
        lines.push(message.content || "[No text content]");

        if (message.attachments?.size) {
            for (const attachment of message.attachments.values()) {
                lines.push(`Attachment: ${attachment.name || "file"} -> ${attachment.url}`);
            }
        }

        if (message.embeds?.length) {
            for (const embed of message.embeds) {
                const title = embed.title ? ` | Title: ${embed.title}` : "";
                const description = embed.description ? ` | Description: ${trimText(embed.description, 500)}` : "";
                lines.push(`Embed${title}${description}`);
            }
        }

        lines.push("");
    }

    return Buffer.from(lines.join("\n"), "utf8");
}

async function editTicketPanel(channel, row) {
    const meta = getTicketMeta(channel);
    if (!meta.panelMessageId) return;
    const panelMessage = await channel.messages.fetch(meta.panelMessageId).catch(() => null);
    if (panelMessage?.author?.id === client.user.id) {
        await panelMessage.edit({ components: [row] }).catch(() => {});
    }
}

function getProtectionSet(type) {
    if (type === "spam") return antiSpamChannels;
    if (type === "link") return antiLinkChannels;
    if (type === "mention") return antiMentionChannels;
    return null;
}

function recordProtectionViolation(userId, key) {
    const now = Date.now();
    const id = `${userId}:${key}`;
    const current = protectionViolations.get(id) || { count: 0, lastAt: 0 };
    if (now - current.lastAt > 60_000) current.count = 0;
    current.count += 1;
    current.lastAt = now;
    protectionViolations.set(id, current);
    return current.count;
}

function getWarningHistory(userId) {
    if (Array.isArray(warnings[userId])) return warnings[userId];

    const legacyCount = Number(warnings[userId] || 0);
    warnings[userId] = [];
    for (let i = 0; i < legacyCount; i++) {
        warnings[userId].push({
            reason: "Legacy warning (details unavailable)",
            moderatorId: null,
            at: 0
        });
    }
    return warnings[userId];
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

async function loadMemberAvatar(member) {
    const avatarUrl = member.displayAvatarURL({
        extension: "png",
        size: 512,
        forceStatic: true
    });

    // Fetch the Discord CDN image ourselves first. This is more reliable
    // on VPS/panel hosts than passing the remote URL directly to loadImage().
    const response = await fetch(avatarUrl);

    if (!response.ok) {
        throw new Error(
            `Could not download Discord avatar (${response.status} ${response.statusText})`
        );
    }

    const avatarBuffer = Buffer.from(
        await response.arrayBuffer()
    );

    return loadImage(avatarBuffer);
}

async function makeWelcomeImage(member) {
    const [background, avatar] =
        await Promise.all([
            getWelcomeTemplate(),
            loadMemberAvatar(member)
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

    // SAM-STUDIO.png is 2048 x 768.
    // The empty round profile area in the supplied artwork is centered
    // at approximately (1675, 365) with a safe inner radius of 188 px.
    // Use the real template dimensions and ONE uniform radius scale so
    // the user's avatar remains perfectly circular instead of stretching.
    const TEMPLATE_WIDTH = 2048;
    const TEMPLATE_HEIGHT = 768;
    const FRAME_CENTER_X = 1675;
    const FRAME_CENTER_Y = 365;
    const FRAME_RADIUS = 188;

    const scaleX = canvas.width / TEMPLATE_WIDTH;
    const scaleY = canvas.height / TEMPLATE_HEIGHT;
    const uniformScale = Math.min(scaleX, scaleY);

    const centerX = FRAME_CENTER_X * scaleX;
    const centerY = FRAME_CENTER_Y * scaleY;
    const radius = FRAME_RADIUS * uniformScale;
    const diameter = radius * 2;

    // Clip the avatar to the inside of the existing western frame.
    context.save();
    context.beginPath();
    context.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
    );
    context.closePath();
    context.clip();

    // "Cover" crop: completely fills the circle without stretching.
    const avatarScale = Math.max(
        diameter / avatar.width,
        diameter / avatar.height
    );

    const drawWidth = avatar.width * avatarScale;
    const drawHeight = avatar.height * avatarScale;
    const drawX = centerX - drawWidth / 2;
    const drawY = centerY - drawHeight / 2;

    context.drawImage(
        avatar,
        drawX,
        drawY,
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

    const staffUser = await client.users.fetch(draft.ownerId).catch(() => null);
    const log = makeLogEmbed({
        title: draft.mode === "edit" ? "Builder Message Edited" : "Builder Message Sent",
        color: draft.accentColor,
        emoji: draft.mode === "edit" ? "✏️" : "📤",
        user: staffUser
    }).addFields(
        { name: "Staff", value: staffUser ? userLabel(staffUser) : `<@${draft.ownerId}> • \`${draft.ownerId}\``, inline: false },
        { name: "Channel", value: formatChannel(channel), inline: false },
        { name: "Message", value: `[Open Message](${sentMessage.url}) • \`${sentMessage.id}\``, inline: false },
        { name: "Title", value: trimText(draft.title || "No title", 1024), inline: true },
        { name: "Pictures", value: String(draft.images.length), inline: true },
        { name: "Buttons", value: String(draft.buttons.length), inline: true },
        { name: "Ping", value: draft.ping === "none" ? "None" : draft.ping === "everyone" ? "@everyone" : `<@&${draft.ping}>`, inline: true },
        { name: "Reactions", value: draft.reactions.length ? draft.reactions.join(" ") : "None", inline: true }
    );

    await sendLog(channel.guild, LOG_CHANNELS.MSG, log);

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

async function cleanupScheduledDraftFiles(draft) {
    for (const image of draft?.images || []) {
        if (!image?.localPath) continue;
        const resolved = path.resolve(image.localPath);
        const uploadDir = path.resolve(MESSAGE_UPLOAD_DIR);
        if (!resolved.startsWith(uploadDir + path.sep)) continue;
        await fs.promises.unlink(resolved).catch(() => {});
    }
}

async function processScheduledMessages() {
    const now = Date.now();

    for (const [draftId, storedDraft] of Object.entries(messageStore.scheduled)) {
        if (!storedDraft.scheduleAt || storedDraft.scheduleAt > now) continue;
        if (storedDraft.nextAttemptAt && storedDraft.nextAttemptAt > now) continue;

        try {
            await deliverMessageDraft(storedDraft);
            await cleanupScheduledDraftFiles(storedDraft);
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

                if (storedDraft.attempts === 3) {
                    const guild = client.guilds.cache.get(storedDraft.guildId);
                    if (guild) {
                        const staffUser = await client.users.fetch(storedDraft.ownerId).catch(() => null);
                        const log = makeLogEmbed({
                            title: "Scheduled Message Failed",
                            color: 0xed4245,
                            emoji: "⚠️",
                            user: staffUser,
                            description: "The scheduled message failed three delivery attempts and was paused for 24 hours."
                        }).addFields(
                            { name: "Draft ID", value: `\`${draftId}\``, inline: true },
                            { name: "Destination", value: `<#${storedDraft.channelId}>`, inline: true },
                            { name: "Error", value: trimText(error.message || "Unknown error", 1024), inline: false }
                        );
                        await sendLog(guild, LOG_CHANNELS.MSG, log);
                    }
                }
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
                !channel.topic?.includes("sam-ticket-user:") &&
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
            o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setMaxLength(500)
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setMaxLength(500)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a user")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Timeout duration in minutes")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setMaxLength(500)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a timeout")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setMaxLength(500)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Warning reason").setMaxLength(500)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a member's warning history")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("clearwarnings")
        .setDescription("Clear a member's warning history")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear messages")
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Amount (1-100)")
                .setMinValue(1)
                .setMaxValue(100)
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
            o.setName("message_id").setDescription("Message ID or message link").setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Message channel (optional)")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        ),

    new SlashCommandBuilder()
        .setName("copymsg")
        .setDescription("Duplicate a message sent by the SAM message builder")
        .addStringOption(o =>
            o.setName("message_id").setDescription("Message ID or message link").setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Original message channel (optional)")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        ),

    new SlashCommandBuilder()
        .setName("deletemsg")
        .setDescription("Delete a message sent by this bot")
        .addStringOption(o =>
            o.setName("message_id").setDescription("Message ID or message link").setRequired(true)
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Message channel (optional)")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        ),

    new SlashCommandBuilder()
        .setName("scheduled")
        .setDescription("View scheduled SAM messages"),

    new SlashCommandBuilder()
        .setName("cancelscheduled")
        .setDescription("Cancel a scheduled SAM message")
        .addStringOption(o =>
            o.setName("draft_id").setDescription("Scheduled draft ID").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Shows detailed server information"),

    new SlashCommandBuilder()
        .setName("memberinfo")
        .setDescription("Shows detailed member information")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("giverole")
        .setDescription("Give a role to one user or all members")
        .addRoleOption(o =>
            o.setName("role").setDescription("Role to give").setRequired(true)
        )
        .addUserOption(o =>
            o.setName("user").setDescription("User (leave empty if using all)").setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName("all").setDescription("Give the role to all non-bot members").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("removerole")
        .setDescription("Remove a role from one user or all members")
        .addRoleOption(o =>
            o.setName("role").setDescription("Role to remove").setRequired(true)
        )
        .addUserOption(o =>
            o.setName("user").setDescription("User (leave empty if using all)").setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName("all").setDescription("Remove the role from all non-bot members").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Start a giveaway")
        .addStringOption(o =>
            o.setName("prize").setDescription("Prize for giveaway").setRequired(true).setMaxLength(200)
        )
        .addStringOption(o =>
            o.setName("duration").setDescription("Duration (e.g. 10m, 2h, 1d)").setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20).setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveawayend")
        .setDescription("End an active giveaway now")
        .addStringOption(o =>
            o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveawayreroll")
        .setDescription("Reroll winners from a finished or active giveaway message")
        .addStringOption(o =>
            o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("winners").setDescription("Number of winners to reroll").setMinValue(1).setMaxValue(20).setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("giveawaycancel")
        .setDescription("Cancel an active giveaway")
        .addStringOption(o =>
            o.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Check tracked invite statistics")
        .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("antiping")
        .setDescription("Manage protected users for anti-ping")
        .addStringOption(o =>
            o.setName("action")
                .setDescription("Action")
                .setRequired(true)
                .addChoices(
                    { name: "Add", value: "add" },
                    { name: "Remove", value: "remove" },
                    { name: "List", value: "list" }
                )
        )
        .addUserOption(o =>
            o.setName("user").setDescription("User to add/remove").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("protection")
        .setDescription("Configure existing spam/link/mention protection")
        .addStringOption(o =>
            o.setName("type")
                .setDescription("Protection type")
                .setRequired(true)
                .addChoices(
                    { name: "Anti Spam", value: "spam" },
                    { name: "Anti Link", value: "link" },
                    { name: "Anti Mass Mention", value: "mention" }
                )
        )
        .addStringOption(o =>
            o.setName("action")
                .setDescription("Enable, disable, or view status")
                .setRequired(true)
                .addChoices(
                    { name: "Enable", value: "enable" },
                    { name: "Disable", value: "disable" },
                    { name: "Status", value: "status" }
                )
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Text channel (defaults to current channel)")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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

        // Ticket permission + invite tracker setup for every connected guild.
        for (const guild of client.guilds.cache.values()) {
            await syncTicketStaffPermissions(guild).catch(() => {});

            try {
                const guildInvites = await guild.invites.fetch();
                guildInvites.forEach(invite => {
                    invites.set(`${guild.id}:${invite.code}`, invite.uses || 0);
                });
                console.log(`Invite Tracker Initialized for ${guild.name} ✅`);
            } catch (error) {
                console.warn(`[INVITES] Could not initialize ${guild.name}:`, error.message);
            }
        }

        await processScheduledMessages();
        await processActiveGiveaways();

        setInterval(processScheduledMessages, 30_000);
        setInterval(processActiveGiveaways, 30_000);

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

                // ================= ANTI PING / PROTECTION =================

                if (cmd === "antiping") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({
                            content: "❌ Administrator permission required!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const action = interaction.options.getString("action");
                    const user = interaction.options.getUser("user");

                    if (["add", "remove"].includes(action) && !user) {
                        return interaction.reply({
                            content: "❌ Select a user for this action.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === "add") {
                        ANTI_PING_MEMBERS.add(user.id);
                        saveBotState();

                        const embed = makeLogEmbed({
                            title: "Anti-Ping Protected User Added",
                            color: 0x2ecc71,
                            emoji: "🛡️",
                            user
                        }).addFields(
                            { name: "Protected User", value: userLabel(user), inline: true },
                            { name: "Added By", value: userLabel(interaction.user), inline: true }
                        );

                        await sendLog(interaction.guild, LOG_CHANNELS.MOD, embed);

                        return interaction.reply({
                            content: `✅ ${user} is now protected by anti-ping.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === "remove") {
                        ANTI_PING_MEMBERS.delete(user.id);
                        saveBotState();

                        const embed = makeLogEmbed({
                            title: "Anti-Ping Protected User Removed",
                            color: 0xe67e22,
                            emoji: "🛡️",
                            user
                        }).addFields(
                            { name: "User", value: userLabel(user), inline: true },
                            { name: "Removed By", value: userLabel(interaction.user), inline: true }
                        );

                        await sendLog(interaction.guild, LOG_CHANNELS.MOD, embed);

                        return interaction.reply({
                            content: `✅ ${user} removed from anti-ping protection.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const list = ANTI_PING_MEMBERS.size
                        ? Array.from(ANTI_PING_MEMBERS).map(id => `<@${id}> • \`${id}\``).join("\n")
                        : "No protected users configured.";

                    return interaction.reply({
                        embeds: [makeLogEmbed({
                            title: "Anti-Ping Protected Users",
                            color: 0x5865f2,
                            emoji: "🛡️",
                            description: trimText(list, 3900)
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (cmd === "protection") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                        return interaction.reply({
                            content: "❌ Manage Server permission required!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const type = interaction.options.getString("type");
                    const action = interaction.options.getString("action");
                    const channel = interaction.options.getChannel("channel") || interaction.channel;
                    const set = getProtectionSet(type);

                    if (!set || !channel?.isTextBased()) {
                        return interaction.reply({
                            content: "❌ Invalid protection type or channel.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === "enable") set.add(channel.id);
                    if (action === "disable") set.delete(channel.id);
                    if (action !== "status") saveBotState();

                    const enabled = set.has(channel.id);
                    const label = {
                        spam: "Anti-Spam",
                        link: "Anti-Link",
                        mention: "Anti-Mass-Mention"
                    }[type];

                    const embed = makeLogEmbed({
                        title: `${label} ${action === "status" ? "Status" : enabled ? "Enabled" : "Disabled"}`,
                        color: enabled ? 0x2ecc71 : 0xe74c3c,
                        emoji: enabled ? "✅" : "⛔"
                    }).addFields(
                        { name: "Protection", value: label, inline: true },
                        { name: "Channel", value: formatChannel(channel), inline: true },
                        { name: "Status", value: enabled ? "🟢 Enabled" : "🔴 Disabled", inline: true },
                        { name: "Changed By", value: userLabel(interaction.user), inline: false }
                    );

                    if (action !== "status") {
                        await sendLog(interaction.guild, LOG_CHANNELS.MOD, embed);
                    }

                    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }

                // =================================================
                // TICKET PANEL
                // =================================================

                if (cmd === "ticketpanel") {

                    if (!isStaffMember(interaction.member) && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                        return interaction.reply({
                            content: "❌ Staff permission required to send the ticket panel.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

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
                            )
                            .setFooter({ text: "SAM STUDIO • Support Center" })
                            .setTimestamp();

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
                    const target = interaction.options.getMember("user") || interaction.member;
                    const stats = inviteStats[target.id] || { joins: 0, leaves: 0 };

                    let currentUses = 0;
                    let activeCodes = 0;
                    try {
                        const guildInvites = await interaction.guild.invites.fetch();
                        guildInvites.forEach(invite => {
                            if (invite.inviter?.id === target.id) {
                                currentUses += invite.uses || 0;
                                activeCodes += 1;
                            }
                        });
                    } catch (error) {}

                    const joined = Number(stats.joins || 0);
                    const left = Number(stats.leaves || 0);
                    const netTracked = Math.max(0, joined - left);

                    const embed = makeLogEmbed({
                        title: `Invite Statistics • ${target.user.username}`,
                        color: 0x5865f2,
                        emoji: "📨",
                        user: target.user,
                        description: "Invite history tracked by this bot. Deleted/vanity invites or joins while the bot was offline may not be recoverable."
                    }).addFields(
                        { name: "👤 Member", value: userLabel(target.user), inline: false },
                        { name: "✅ Tracked Joins", value: `**${joined}**`, inline: true },
                        { name: "🚪 Tracked Leaves", value: `**${left}**`, inline: true },
                        { name: "📊 Net Tracked", value: `**${netTracked}**`, inline: true },
                        { name: "🔗 Current Invite Uses", value: `**${currentUses}**`, inline: true },
                        { name: "🎟️ Active Invite Codes", value: `**${activeCodes}**`, inline: true }
                    );

                    return interaction.reply({ embeds: [embed] });
                }

                // ================= GIVEAWAY =================

                if (cmd === "giveaway") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                        return interaction.reply({
                            content: "❌ Manage Server permission required!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const prize = interaction.options.getString("prize");
                    const durationStr = interaction.options.getString("duration");
                    const winnersCount = interaction.options.getInteger("winners");
                    const durationMs = parseDuration(durationStr);

                    if (!durationMs) {
                        return interaction.reply({
                            content: "❌ Invalid duration. Use formats like `10m`, `2h`, or `1d`.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const endTime = Date.now() + durationMs;
                    const embed = makeLogEmbed({
                        title: "GIVEAWAY",
                        color: 0x57f287,
                        emoji: "🎉",
                        description: `React with 🎉 to enter!\n\n**Prize**\n${trimText(prize, 500)}`,
                        footer: `Hosted by ${interaction.user.tag} • SAM STUDIO Giveaways`
                    }).addFields(
                        { name: "🏆 Winners", value: `**${winnersCount}**`, inline: true },
                        { name: "⏳ Ends", value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
                        { name: "📅 End Time", value: `<t:${Math.floor(endTime / 1000)}:F>`, inline: false }
                    );

                    const msg = await interaction.channel.send({ embeds: [embed] });
                    await msg.react("🎉");

                    activeGiveaways.set(msg.id, {
                        messageId: msg.id,
                        channelId: interaction.channel.id,
                        guildId: interaction.guildId,
                        prize,
                        winners: winnersCount,
                        endTime,
                        hostId: interaction.user.id,
                        ended: false
                    });
                    saveBotState();

                    const log = makeLogEmbed({
                        title: "Giveaway Started",
                        color: 0x57f287,
                        emoji: "🎉",
                        user: interaction.user
                    }).addFields(
                        { name: "Host", value: userLabel(interaction.user), inline: true },
                        { name: "Channel", value: formatChannel(interaction.channel), inline: true },
                        { name: "Prize", value: trimText(prize, 1024), inline: false },
                        { name: "Winners", value: String(winnersCount), inline: true },
                        { name: "Ends", value: `<t:${Math.floor(endTime / 1000)}:F>`, inline: true },
                        { name: "Message", value: `[Open Giveaway](${msg.url})`, inline: false }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                    return interaction.reply({
                        content: `✅ Giveaway started: ${msg.url}`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (["giveawayend", "giveawaycancel", "giveawayreroll"].includes(cmd)) {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                        return interaction.reply({
                            content: "❌ Manage Server permission required!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const messageId = interaction.options.getString("message_id");

                    if (cmd === "giveawayend") {
                        const result = await endGiveaway(messageId, { forcedBy: interaction.user });
                        return interaction.reply({
                            content: result || "✅ Giveaway processing completed.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cmd === "giveawaycancel") {
                        const giveaway = activeGiveaways.get(messageId);
                        if (!giveaway) {
                            return interaction.reply({
                                content: "❌ Active giveaway not found.",
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        const channel = interaction.guild.channels.cache.get(giveaway.channelId) ||
                            await interaction.guild.channels.fetch(giveaway.channelId).catch(() => null);
                        const msg = channel?.isTextBased()
                            ? await channel.messages.fetch(messageId).catch(() => null)
                            : null;

                        if (msg) {
                            const cancelled = makeLogEmbed({
                                title: "Giveaway Cancelled",
                                color: 0xe74c3c,
                                emoji: "🚫",
                                description: `**Prize**\n${trimText(giveaway.prize, 500)}`,
                                footer: `Cancelled by ${interaction.user.tag} • SAM STUDIO Giveaways`
                            });
                            await msg.edit({ embeds: [cancelled] }).catch(() => {});
                        }

                        activeGiveaways.delete(messageId);
                        saveBotState();

                        const log = makeLogEmbed({
                            title: "Giveaway Cancelled",
                            color: 0xe74c3c,
                            emoji: "🚫",
                            user: interaction.user
                        }).addFields(
                            { name: "Cancelled By", value: userLabel(interaction.user), inline: true },
                            { name: "Message ID", value: `\`${messageId}\``, inline: true },
                            { name: "Prize", value: trimText(giveaway.prize, 1024), inline: false }
                        );
                        await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                        return interaction.reply({
                            content: "✅ Giveaway cancelled.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const winnersCount = interaction.options.getInteger("winners") || 1;
                    const result = await rerollGiveaway(interaction.guild, interaction.channel, messageId, winnersCount, interaction.user);
                    return interaction.reply({
                        content: result,
                        flags: MessageFlags.Ephemeral
                    });
                }

                // ================= MODERATION =================

                if (["ban", "kick", "mute", "unmute"].includes(cmd)) {
                    const requiredPermission = {
                        ban: PermissionsBitField.Flags.BanMembers,
                        kick: PermissionsBitField.Flags.KickMembers,
                        mute: PermissionsBitField.Flags.ModerateMembers,
                        unmute: PermissionsBitField.Flags.ModerateMembers
                    }[cmd];

                    if (!interaction.member.permissions.has(requiredPermission)) {
                        return interaction.reply({
                            content: "❌ You do not have permission to use this command.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const target = interaction.options.getMember("user");
                    const reason = interaction.options.getString("reason") || "No reason provided";
                    const targetError = moderationTargetError(interaction, target, cmd);
                    if (targetError) {
                        return interaction.reply({ content: targetError, flags: MessageFlags.Ephemeral });
                    }

                    if (cmd === "ban" && !target.bannable) {
                        return interaction.reply({
                            content: "❌ I cannot ban this member. Check my role position and permissions.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    if (cmd === "kick" && !target.kickable) {
                        return interaction.reply({
                            content: "❌ I cannot kick this member. Check my role position and permissions.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    if (["mute", "unmute"].includes(cmd) && !target.moderatable) {
                        return interaction.reply({
                            content: "❌ I cannot timeout this member. Check my role position and permissions.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    let title;
                    let color;
                    let emoji;
                    let actionDetail;

                    if (cmd === "ban") {
                        await target.ban({ reason: `${reason} | Moderator: ${interaction.user.tag}` });
                        title = "Member Banned";
                        color = 0xed4245;
                        emoji = "🔨";
                        actionDetail = "Banned from server";
                    } else if (cmd === "kick") {
                        await target.kick(`${reason} | Moderator: ${interaction.user.tag}`);
                        title = "Member Kicked";
                        color = 0xe67e22;
                        emoji = "👢";
                        actionDetail = "Kicked from server";
                    } else if (cmd === "mute") {
                        const minutes = interaction.options.getInteger("minutes");
                        await target.timeout(minutes * 60_000, `${reason} | Moderator: ${interaction.user.tag}`);
                        title = "Member Timed Out";
                        color = 0xf1c40f;
                        emoji = "🔇";
                        actionDetail = `${minutes} minute(s) • until <t:${Math.floor((Date.now() + minutes * 60_000) / 1000)}:F>`;
                    } else {
                        await target.timeout(null, `${reason} | Moderator: ${interaction.user.tag}`);
                        title = "Timeout Removed";
                        color = 0x57f287;
                        emoji = "🔊";
                        actionDetail = "Timeout removed";
                    }

                    const log = makeLogEmbed({
                        title,
                        color,
                        emoji,
                        user: target.user
                    }).addFields(
                        { name: "👤 Target", value: userLabel(target.user), inline: false },
                        { name: "🛡️ Moderator", value: userLabel(interaction.user), inline: false },
                        { name: "📌 Action", value: actionDetail, inline: true },
                        { name: "📝 Reason", value: trimText(reason, 1024), inline: false },
                        { name: "💬 Channel", value: formatChannel(interaction.channel), inline: false },
                        { name: "🌐 Command Locale", value: `\`${interaction.locale || "Unknown"}\``, inline: true }
                    );

                    await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                    return interaction.reply({
                        embeds: [makeLogEmbed({
                            title,
                            color,
                            emoji,
                            user: target.user,
                            footer: "SAM STUDIO • Moderation"
                        }).addFields(
                            { name: "Target", value: `${target} • \`${target.user.tag}\``, inline: true },
                            { name: "Reason", value: trimText(reason, 1024), inline: false },
                            { name: "Action", value: actionDetail, inline: false }
                        )],
                        flags: MessageFlags.Ephemeral
                    });
                }

                // ================= WARNINGS =================

                if (cmd === "warn") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                        return interaction.reply({
                            content: "❌ Moderate Members permission required.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const target = interaction.options.getMember("user");
                    const reason = interaction.options.getString("reason") || "No reason provided";
                    const targetError = moderationTargetError(interaction, target, "warn");
                    if (targetError) {
                        return interaction.reply({ content: targetError, flags: MessageFlags.Ephemeral });
                    }

                    const history = getWarningHistory(target.id);
                    history.push({
                        reason,
                        moderatorId: interaction.user.id,
                        at: Date.now()
                    });
                    saveBotState();

                    const log = makeLogEmbed({
                        title: "Member Warned",
                        color: 0xfee75c,
                        emoji: "⚠️",
                        user: target.user
                    }).addFields(
                        { name: "👤 Member", value: userLabel(target.user), inline: false },
                        { name: "🛡️ Moderator", value: userLabel(interaction.user), inline: false },
                        { name: "📊 Total Warnings", value: `**${history.length}**`, inline: true },
                        { name: "📝 Reason", value: trimText(reason, 1024), inline: false }
                    );

                    await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                    await target.send({
                        embeds: [makeLogEmbed({
                            title: `Warning from ${interaction.guild.name}`,
                            color: 0xfee75c,
                            emoji: "⚠️",
                            description: `You received warning **#${history.length}**.`,
                            footer: "SAM STUDIO • Moderation Notice"
                        }).addFields({ name: "Reason", value: trimText(reason, 1024) })]
                    }).catch(() => {});

                    return interaction.reply({
                        content: `✅ ${target} warned. Total warnings: **${history.length}**.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (cmd === "warnings") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                        return interaction.reply({
                            content: "❌ Moderate Members permission required.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const target = interaction.options.getMember("user") || interaction.member;
                    const history = getWarningHistory(target.id);
                    const recent = history.slice(-10).reverse();
                    const description = recent.length
                        ? recent.map((item, index) => {
                            const number = history.length - index;
                            const when = item.at ? `<t:${Math.floor(item.at / 1000)}:f>` : "Legacy";
                            const mod = item.moderatorId ? `<@${item.moderatorId}>` : "Unknown";
                            return `**#${number}** • ${when} • ${mod}\n${trimText(item.reason, 250)}`;
                        }).join("\n\n")
                        : "No warnings recorded.";

                    return interaction.reply({
                        embeds: [makeLogEmbed({
                            title: `Warning History • ${target.user.username}`,
                            color: history.length ? 0xfee75c : 0x57f287,
                            emoji: "⚠️",
                            user: target.user,
                            description: trimText(description, 3900),
                            footer: `Total warnings: ${history.length} • Showing up to 10 latest`
                        })],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (cmd === "clearwarnings") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({
                            content: "❌ Administrator permission required.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const target = interaction.options.getUser("user");
                    const oldCount = getWarningHistory(target.id).length;
                    warnings[target.id] = [];
                    saveBotState();

                    const log = makeLogEmbed({
                        title: "Warnings Cleared",
                        color: 0x57f287,
                        emoji: "🧹",
                        user: target
                    }).addFields(
                        { name: "Member", value: userLabel(target), inline: false },
                        { name: "Cleared By", value: userLabel(interaction.user), inline: false },
                        { name: "Warnings Removed", value: String(oldCount), inline: true }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                    return interaction.reply({
                        content: `✅ Cleared **${oldCount}** warning(s) for ${target}.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                // ================= CLEAR =================

                if (cmd === "clear") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                        return interaction.reply({
                            content: "❌ Manage Messages permission required.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const amount = interaction.options.getInteger("amount");
                    const deleted = await interaction.channel.bulkDelete(amount, true);

                    const log = makeLogEmbed({
                        title: "Messages Bulk Deleted",
                        color: 0xed4245,
                        emoji: "🧹",
                        user: interaction.user
                    }).addFields(
                        { name: "Moderator", value: userLabel(interaction.user), inline: false },
                        { name: "Channel", value: formatChannel(interaction.channel), inline: false },
                        { name: "Requested", value: String(amount), inline: true },
                        { name: "Deleted", value: String(deleted.size), inline: true }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.MOD, log);

                    return interaction.reply({
                        content: `✅ Deleted **${deleted.size}** message(s). Messages older than Discord's bulk-delete limit are automatically skipped.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                // ================= MESSAGE BUILDER / SCHEDULED =================

                if (["scheduled", "cancelscheduled"].includes(cmd)) {
                    if (!hasMessageBuilderPermission(interaction.member)) {
                        return interaction.reply({
                            content: "❌ No permission.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cmd === "scheduled") {
                        const items = Object.entries(messageStore.scheduled || {})
                            .filter(([, draft]) => draft.guildId === interaction.guildId)
                            .sort((a, b) => (a[1].scheduleAt || 0) - (b[1].scheduleAt || 0))
                            .slice(0, 20);

                        const description = items.length
                            ? items.map(([id, draft], index) =>
                                `**${index + 1}. ${trimText(draft.title || "Untitled Message", 80)}**\n` +
                                `ID: \`${id}\` • <#${draft.channelId}> • <t:${Math.floor(draft.scheduleAt / 1000)}:F>`
                            ).join("\n\n")
                            : "No scheduled messages for this server.";

                        return interaction.reply({
                            embeds: [makeLogEmbed({
                                title: "Scheduled Messages",
                                color: 0x5865f2,
                                emoji: "⏰",
                                description: trimText(description, 3900),
                                footer: "Use /cancelscheduled with the draft ID to cancel one"
                            })],
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const draftId = interaction.options.getString("draft_id");
                    const draft = messageStore.scheduled?.[draftId];
                    if (!draft || draft.guildId !== interaction.guildId) {
                        return interaction.reply({
                            content: "❌ Scheduled message not found for this server.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await cleanupScheduledDraftFiles(draft);
                    delete messageStore.scheduled[draftId];
                    saveMessageStore();

                    const log = makeLogEmbed({
                        title: "Scheduled Message Cancelled",
                        color: 0xe74c3c,
                        emoji: "⏰",
                        user: interaction.user
                    }).addFields(
                        { name: "Cancelled By", value: userLabel(interaction.user), inline: false },
                        { name: "Destination", value: `<#${draft.channelId}>`, inline: true },
                        { name: "Draft ID", value: `\`${draftId}\``, inline: true },
                        { name: "Original Schedule", value: `<t:${Math.floor(draft.scheduleAt / 1000)}:F>`, inline: false }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.MSG, log);

                    return interaction.reply({
                        content: "✅ Scheduled message cancelled.",
                        flags: MessageFlags.Ephemeral
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

                        const log = makeLogEmbed({
                            title: "Builder Message Deleted",
                            color: 0xed4245,
                            emoji: "🗑️",
                            user: interaction.user
                        }).addFields(
                            { name: "Staff", value: userLabel(interaction.user), inline: false },
                            { name: "Channel", value: channel ? formatChannel(channel) : `<#${deletionChannelId}>`, inline: false },
                            { name: "Message ID", value: `\`${reference.messageId}\``, inline: true }
                        );

                        await sendLog(interaction.guild, LOG_CHANNELS.MSG, log);

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
                    const guild = interaction.guild;
                    const owner = await guild.fetchOwner().catch(() => null);
                    const textChannels = guild.channels.cache.filter(c =>
                        [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)
                    ).size;
                    const voiceChannels = guild.channels.cache.filter(c =>
                        [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
                    ).size;
                    const categoryCount = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

                    const embed = makeLogEmbed({
                        title: `${guild.name} • Server Information`,
                        color: 0x5865f2,
                        emoji: "🏰",
                        description: guild.description || "No server description set.",
                        footer: `Server ID: ${guild.id} • SAM STUDIO`
                    })
                        .setThumbnail(guild.iconURL({ extension: "png", size: 512, forceStatic: false }))
                        .addFields(
                            { name: "👑 Owner", value: owner ? userLabel(owner.user) : "Unknown", inline: false },
                            { name: "👥 Members", value: `**${guild.memberCount}**`, inline: true },
                            { name: "💎 Boosts", value: `**${guild.premiumSubscriptionCount || 0}** • Tier ${guild.premiumTier}`, inline: true },
                            { name: "🎭 Roles", value: `**${Math.max(0, guild.roles.cache.size - 1)}**`, inline: true },
                            { name: "💬 Text Channels", value: `**${textChannels}**`, inline: true },
                            { name: "🔊 Voice Channels", value: `**${voiceChannels}**`, inline: true },
                            { name: "📁 Categories", value: `**${categoryCount}**`, inline: true },
                            { name: "🌐 Server Locale", value: `\`${guild.preferredLocale || "Unknown"}\``, inline: true },
                            { name: "🛡️ Verification", value: `\`${guild.verificationLevel}\``, inline: true },
                            { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
                        );

                    if (guild.bannerURL()) {
                        embed.setImage(guild.bannerURL({ extension: "png", size: 1024, forceStatic: false }));
                    }

                    return interaction.reply({ embeds: [embed] });
                }

                // ================= MEMBER INFO =================

                if (cmd === "memberinfo") {
                    const target = interaction.options.getMember("user") || interaction.member;
                    const roles = target.roles.cache
                        .filter(role => role.id !== interaction.guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(role => role.toString());
                    const roleText = roles.length ? trimText(roles.join(" "), 1000) : "No roles";
                    const timeoutText = target.communicationDisabledUntilTimestamp &&
                        target.communicationDisabledUntilTimestamp > Date.now()
                        ? `<t:${Math.floor(target.communicationDisabledUntilTimestamp / 1000)}:F>`
                        : "Not timed out";
                    const status = target.presence?.status || "offline / unavailable";

                    const embed = makeLogEmbed({
                        title: `Member Information • ${target.user.username}`,
                        color: target.displayColor || 0x5865f2,
                        emoji: "👤",
                        user: target.user,
                        footer: `User ID: ${target.id} • SAM STUDIO`
                    }).addFields(
                        { name: "👤 User", value: userLabel(target.user), inline: false },
                        { name: "🏷️ Nickname", value: target.nickname || "None", inline: true },
                        { name: "🤖 Account Type", value: target.user.bot ? "Bot" : "User", inline: true },
                        { name: "🟢 Status", value: status, inline: true },
                        { name: "📅 Account Created", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:F>\n<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: false },
                        { name: "📥 Joined Server", value: target.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>\n<t:${Math.floor(target.joinedTimestamp / 1000)}:R>` : "Unknown", inline: false },
                        { name: "🔇 Timeout", value: timeoutText, inline: false },
                        { name: `🎭 Roles (${roles.length})`, value: roleText, inline: false }
                    );

                    if (target.id === interaction.user.id) {
                        embed.addFields({
                            name: "🌐 Discord Client Language",
                            value: `\`${interaction.locale || "Unknown"}\`\n*This is a language/locale setting, not an IP address or verified country.*`,
                            inline: false
                        });
                    }

                    return interaction.reply({ embeds: [embed] });
                }

                // ================= ROLE MANAGEMENT =================

                if (["giverole", "removerole"].includes(cmd)) {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        return interaction.reply({
                            content: "❌ Manage Roles permission required.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const role = interaction.options.getRole("role");
                    const selectedUser = interaction.options.getMember("user");
                    const applyAll = interaction.options.getBoolean("all") || false;
                    const adding = cmd === "giverole";

                    if (!role || role.id === interaction.guild.id || role.managed) {
                        return interaction.reply({
                            content: "❌ That role cannot be managed by this command.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!role.editable) {
                        return interaction.reply({
                            content: "❌ My bot role must be above the selected role.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (
                        interaction.guild.ownerId !== interaction.user.id &&
                        interaction.member.roles.highest.comparePositionTo(role) <= 0
                    ) {
                        return interaction.reply({
                            content: "❌ Your highest role must be above the selected role.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if ((!selectedUser && !applyAll) || (selectedUser && applyAll)) {
                        return interaction.reply({
                            content: "❌ Choose either a specific user OR set `all` to true.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    let success = 0;
                    let failed = 0;
                    let skipped = 0;

                    if (applyAll) {
                        const members = await interaction.guild.members.fetch();
                        for (const [, member] of members) {
                            if (member.user.bot) continue;
                            try {
                                if (adding && !member.roles.cache.has(role.id)) {
                                    await member.roles.add(role, `Bulk role action by ${interaction.user.tag}`);
                                    success += 1;
                                } else if (!adding && member.roles.cache.has(role.id)) {
                                    await member.roles.remove(role, `Bulk role action by ${interaction.user.tag}`);
                                    success += 1;
                                } else {
                                    skipped += 1;
                                }
                            } catch (error) {
                                failed += 1;
                            }
                        }
                    } else {
                        const targetError = moderationTargetError(interaction, selectedUser, "role management");
                        if (targetError) return interaction.editReply(targetError);

                        if (adding) {
                            await selectedUser.roles.add(role, `Role added by ${interaction.user.tag}`);
                        } else {
                            await selectedUser.roles.remove(role, `Role removed by ${interaction.user.tag}`);
                        }
                        success = 1;
                    }

                    const log = makeLogEmbed({
                        title: adding ? "Role Assigned" : "Role Removed",
                        color: adding ? 0x57f287 : 0xe67e22,
                        emoji: adding ? "➕" : "➖",
                        user: selectedUser?.user || interaction.user
                    }).addFields(
                        { name: "Role", value: `${role} • \`${role.name}\` • \`${role.id}\``, inline: false },
                        { name: "Performed By", value: userLabel(interaction.user), inline: false },
                        { name: "Target", value: applyAll ? "All non-bot members" : userLabel(selectedUser.user), inline: false },
                        { name: "Successful Changes", value: String(success), inline: true },
                        { name: "Failed", value: String(failed), inline: true },
                        { name: "Skipped", value: String(skipped), inline: true }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.ROLE, log);

                    return interaction.editReply({
                        embeds: [makeLogEmbed({
                            title: adding ? "Role Assignment Complete" : "Role Removal Complete",
                            color: 0x5865f2,
                            emoji: "🎭",
                            footer: "SAM STUDIO • Role Manager"
                        }).addFields(
                            { name: "Role", value: `${role}`, inline: true },
                            { name: "Successful", value: String(success), inline: true },
                            { name: "Failed", value: String(failed), inline: true },
                            { name: "Skipped", value: String(skipped), inline: true }
                        )]
                    });
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

                        if (
                            draft.ping === "everyone" &&
                            !interaction.member.permissions.has(PermissionsBitField.Flags.MentionEveryone)
                        ) {
                            throw new Error("You need Mention @everyone permission to use an everyone ping.");
                        }

                        if (/^\d{17,20}$/.test(draft.ping || "")) {
                            const pingRole = interaction.guild.roles.cache.get(draft.ping);
                            if (
                                pingRole &&
                                !pingRole.mentionable &&
                                !interaction.member.permissions.has(PermissionsBitField.Flags.MentionEveryone)
                            ) {
                                throw new Error("That role is not mentionable and you do not have permission to mention restricted roles.");
                            }
                        }

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
                                `\`\`\`${trimText(f.value || "N/A", 950)}\`\`\``
                        });
                    }
                );

                // ================= TICKET EMBED =================

                const openerMember = interaction.member;
                const embed = makeLogEmbed({
                    title: `${TICKET_LABELS[type] || "Support"} Ticket`,
                    color: 0x5865f2,
                    emoji: EMOJIS[type] || "🎫",
                    user: interaction.user,
                    description:
                        `Welcome ${interaction.user}. Thank you for contacting **SAM STUDIO**.\n` +
                        `A staff member will review your request shortly. Please keep all relevant details in this channel.`,
                    footer: `Ticket opened by ${interaction.user.tag} • SAM STUDIO Support`
                }).addFields(
                    { name: "👤 Opened By", value: userLabel(interaction.user), inline: false },
                    { name: "🎟️ Category", value: TICKET_LABELS[type] || type, inline: true },
                    { name: "🌐 Client Language", value: `\`${interaction.locale || "Unknown"}\``, inline: true },
                    { name: "📅 Account Created", value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: "📥 Joined Server", value: openerMember?.joinedTimestamp ? `<t:${Math.floor(openerMember.joinedTimestamp / 1000)}:R>` : "Unknown", inline: true },
                    ...fields
                );

                const panelMessage = await ticketChannel.send({
                    content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
                    embeds: [embed],
                    components: [openTicketButtons(null)],
                    allowedMentions: {
                        parse: [],
                        users: [interaction.user.id],
                        roles: [STAFF_ROLE_ID]
                    }
                });

                await setTicketMeta(ticketChannel, { panelMessageId: panelMessage.id });

                const log = makeLogEmbed({
                    title: "Ticket Created",
                    color: 0x3498db,
                    emoji: "🎫",
                    user: interaction.user
                }).addFields(
                    { name: "👤 User", value: userLabel(interaction.user), inline: false },
                    { name: "💬 Ticket Channel", value: formatChannel(ticketChannel), inline: false },
                    { name: "🎟️ Type", value: TICKET_LABELS[type] || type.toUpperCase(), inline: true },
                    { name: "🌐 Client Language", value: `\`${interaction.locale || "Unknown"}\``, inline: true },
                    { name: "🆔 Ticket Message", value: `\`${panelMessage.id}\``, inline: false }
                );

                await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);

                return interaction.editReply({
                    embeds: [makeLogEmbed({
                        title: "Ticket Created Successfully",
                        color: 0x57f287,
                        emoji: "✅",
                        description: `Your ticket is ready: ${ticketChannel}`,
                        footer: "SAM STUDIO • Support"
                    })]
                });
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
                // TICKET ACTIONS
                // =================================================

                if (interaction.customId === "claim") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.reply({ content: "❌ Staff only.", flags: MessageFlags.Ephemeral });
                    }

                    if (interaction.channel.name.startsWith("closed-")) {
                        return interaction.reply({
                            content: "❌ This ticket is closed. Reopen it before claiming.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const meta = getTicketMeta(interaction.channel);
                    if (meta.claimedBy) {
                        return interaction.reply({
                            content: `ℹ️ This ticket is already claimed by <@${meta.claimedBy}>.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await setTicketMeta(interaction.channel, { claimedBy: interaction.user.id });
                    await interaction.message.edit({ components: [openTicketButtons(interaction.user.id)] }).catch(() => {});

                    const log = makeLogEmbed({
                        title: "Ticket Claimed",
                        color: 0x57f287,
                        emoji: "🙋",
                        user: interaction.user
                    }).addFields(
                        { name: "Staff Member", value: userLabel(interaction.user), inline: false },
                        { name: "Ticket", value: formatChannel(interaction.channel), inline: false },
                        { name: "Ticket Type", value: TICKET_LABELS[meta.type] || meta.type, inline: true }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);

                    await interaction.channel.send({
                        embeds: [makeLogEmbed({
                            title: "Ticket Claimed",
                            color: 0x57f287,
                            emoji: "✅",
                            description: `${interaction.user} is now handling this ticket.`,
                            footer: "SAM STUDIO • Support"
                        })],
                        allowedMentions: { parse: [], users: [interaction.user.id], roles: [] }
                    }).catch(() => {});

                    return interaction.reply({
                        content: "✅ Ticket claimed successfully.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === "close") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.reply({ content: "❌ Staff only.", flags: MessageFlags.Ephemeral });
                    }

                    if (interaction.channel.name.startsWith("closed-")) {
                        return interaction.reply({
                            content: "ℹ️ This ticket is already closed.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        embeds: [makeLogEmbed({
                            title: "Close Ticket?",
                            color: 0xed4245,
                            emoji: "🔒",
                            description: "A full transcript will be generated. The opener will lose send permission until the ticket is reopened.",
                            footer: "This confirmation is private"
                        })],
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("ticket_close_confirm")
                                .setLabel("Yes, Close")
                                .setEmoji("🔒")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId("ticket_close_cancel")
                                .setLabel("Cancel")
                                .setStyle(ButtonStyle.Secondary)
                        )],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === "ticket_close_cancel") {
                    return interaction.update({
                        content: "✅ Ticket close cancelled.",
                        embeds: [],
                        components: []
                    });
                }

                if (interaction.customId === "ticket_close_confirm") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.update({ content: "❌ Staff only.", embeds: [], components: [] });
                    }

                    if (interaction.channel.name.startsWith("closed-")) {
                        return interaction.update({ content: "ℹ️ Ticket is already closed.", embeds: [], components: [] });
                    }

                    await interaction.update({ content: "🔒 Closing ticket and generating transcript...", embeds: [], components: [] });

                    const channel = interaction.channel;
                    const meta = getTicketMeta(channel);
                    const transcriptBuffer = await makeTicketTranscript(channel);
                    const creator = meta.userId
                        ? await interaction.guild.members.fetch(meta.userId).catch(() => null)
                        : await getTicketCreator(channel);
                    let dmSent = false;

                    if (creator) {
                        await creator.send({
                            embeds: [makeLogEmbed({
                                title: "Your Ticket Was Closed",
                                color: 0xed4245,
                                emoji: "📄",
                                description: `Ticket: **${channel.name}**\nA complete text transcript is attached.`,
                                footer: `${interaction.guild.name} • Support Transcript`
                            })],
                            files: [{
                                attachment: transcriptBuffer,
                                name: `transcript-${channel.id}.txt`
                            }]
                        }).then(() => { dmSent = true; }).catch(() => {});

                        await channel.permissionOverwrites.edit(creator.id, {
                            ViewChannel: true,
                            SendMessages: false,
                            ReadMessageHistory: true,
                            AddReactions: false
                        }).catch(() => {});
                    }

                    await channel.setParent(CLOSED_CATEGORY_ID).catch(() => {});
                    if (!channel.name.startsWith("closed-")) {
                        await channel.setName(`closed-${channel.name}`);
                    }
                    await editTicketPanel(channel, closedTicketButtons());

                    const log = makeLogEmbed({
                        title: "Ticket Closed",
                        color: 0xed4245,
                        emoji: "🔒",
                        user: interaction.user
                    }).addFields(
                        { name: "Closed By", value: userLabel(interaction.user), inline: false },
                        { name: "Ticket", value: formatChannel(channel), inline: false },
                        { name: "Opener", value: meta.userId ? `<@${meta.userId}> • \`${meta.userId}\`` : "Unknown", inline: false },
                        { name: "Claimed By", value: meta.claimedBy ? `<@${meta.claimedBy}> • \`${meta.claimedBy}\`` : "Not claimed", inline: false },
                        { name: "Transcript DM", value: dmSent ? "✅ Sent" : "⚠️ Could not DM", inline: true }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log, {
                        files: [{ attachment: transcriptBuffer, name: `transcript-${channel.id}.txt` }]
                    });

                    await interaction.editReply({
                        content: dmSent
                            ? "✅ Ticket closed. Full transcript was logged and sent to the opener."
                            : "✅ Ticket closed. Full transcript was logged; opener's DMs were unavailable."
                    }).catch(() => {});
                    return;
                }

                if (interaction.customId === "reopen") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.reply({ content: "❌ Staff only.", flags: MessageFlags.Ephemeral });
                    }

                    if (!interaction.channel.name.startsWith("closed-")) {
                        return interaction.reply({
                            content: "ℹ️ This ticket is already open.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const channel = interaction.channel;
                    const meta = getTicketMeta(channel);
                    const originalCategory = await getTicketCategory(interaction.guild, meta.type);

                    await channel.setParent(originalCategory.id).catch(() => {});
                    await channel.setName(channel.name.replace(/^closed-/, ""));

                    if (meta.userId) {
                        await channel.permissionOverwrites.edit(meta.userId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            AddReactions: true
                        }).catch(() => {});
                    }

                    await setTicketMeta(channel, { claimedBy: null });
                    await editTicketPanel(channel, openTicketButtons(null));

                    const log = makeLogEmbed({
                        title: "Ticket Reopened",
                        color: 0x57f287,
                        emoji: "🔓",
                        user: interaction.user
                    }).addFields(
                        { name: "Reopened By", value: userLabel(interaction.user), inline: false },
                        { name: "Ticket", value: formatChannel(channel), inline: false },
                        { name: "Ticket Type", value: TICKET_LABELS[meta.type] || meta.type, inline: true },
                        { name: "Opener Access", value: meta.userId ? `✅ Restored for <@${meta.userId}>` : "⚠️ Opener unknown", inline: false }
                    );
                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);

                    await channel.send({
                        embeds: [makeLogEmbed({
                            title: "Ticket Reopened",
                            color: 0x57f287,
                            emoji: "🔓",
                            description: `Reopened by ${interaction.user}. The ticket can be claimed again.`,
                            footer: "SAM STUDIO • Support"
                        })]
                    }).catch(() => {});

                    return interaction.editReply("✅ Ticket reopened and opener permissions restored.");
                }

                if (interaction.customId === "delete") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.reply({ content: "❌ Staff only.", flags: MessageFlags.Ephemeral });
                    }

                    return interaction.reply({
                        embeds: [makeLogEmbed({
                            title: "Delete Ticket Permanently?",
                            color: 0xed4245,
                            emoji: "🗑️",
                            description: "The final transcript will be saved in the ticket log channel before deletion. This cannot be undone.",
                            footer: "This confirmation is private"
                        })],
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("ticket_delete_confirm")
                                .setLabel("Delete Permanently")
                                .setEmoji("🗑️")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId("ticket_delete_cancel")
                                .setLabel("Cancel")
                                .setStyle(ButtonStyle.Secondary)
                        )],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.customId === "ticket_delete_cancel") {
                    return interaction.update({
                        content: "✅ Ticket deletion cancelled.",
                        embeds: [],
                        components: []
                    });
                }

                if (interaction.customId === "ticket_delete_confirm") {
                    if (!isStaffMember(interaction.member)) {
                        return interaction.update({ content: "❌ Staff only.", embeds: [], components: [] });
                    }

                    await interaction.update({ content: "🗑️ Saving final transcript and deleting ticket...", embeds: [], components: [] });
                    const channel = interaction.channel;
                    const meta = getTicketMeta(channel);
                    const transcriptBuffer = await makeTicketTranscript(channel);

                    const log = makeLogEmbed({
                        title: "Ticket Deleted",
                        color: 0x2f3136,
                        emoji: "🗑️",
                        user: interaction.user
                    }).addFields(
                        { name: "Deleted By", value: userLabel(interaction.user), inline: false },
                        { name: "Ticket", value: `\`${channel.name}\` • \`${channel.id}\``, inline: false },
                        { name: "Opener", value: meta.userId ? `<@${meta.userId}> • \`${meta.userId}\`` : "Unknown", inline: false },
                        { name: "Claimed By", value: meta.claimedBy ? `<@${meta.claimedBy}> • \`${meta.claimedBy}\`` : "Not claimed", inline: false }
                    );

                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log, {
                        files: [{ attachment: transcriptBuffer, name: `transcript-${channel.id}.txt` }]
                    });

                    return channel.delete(`Ticket deleted by ${interaction.user.tag}`);
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
// ANTI-PING + SPAM / LINK / MENTION PROTECTION
// =====================================================

async function sendProtectionNotice(message, title, description, color = 0xe67e22) {
    const notice = await message.channel.send({
        content: `${message.author}`,
        embeds: [makeLogEmbed({
            title,
            color,
            emoji: "🛡️",
            description,
            footer: "SAM STUDIO • Auto Moderation"
        })],
        allowedMentions: { parse: [], users: [message.author.id], roles: [] }
    }).catch(() => null);

    if (notice) {
        setTimeout(() => notice.delete().catch(() => {}), 8000);
    }
}

async function protectionLog(message, title, reason, color = 0xe67e22, extraFields = []) {
    const embed = makeLogEmbed({
        title,
        color,
        emoji: "🛡️",
        user: message.author
    }).addFields(
        { name: "User", value: userLabel(message.author), inline: false },
        { name: "Channel", value: formatChannel(message.channel), inline: false },
        { name: "Reason", value: trimText(reason, 1024), inline: false },
        { name: "Message", value: trimText(message.content || "No text content", 1024), inline: false },
        ...extraFields
    );
    await sendLog(message.guild, LOG_CHANNELS.MOD, embed);
}

client.on(
    Events.MessageCreate,
    async (message) => {
        if (message.author.bot || !message.guild) return;

        // ================= AUTO MESSAGE =================
        if (message.content.toLowerCase() === "!automsg") {
            if (!message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages)) return;

            const autoEmbed = makeLogEmbed({
                title: "Welcome to SAM STUDIO",
                color: 0x5865f2,
                emoji: "✨",
                description: "Enjoy your stay! Follow the rules and have fun.",
                footer: "SAM STUDIO"
            });
            return message.channel.send({ embeds: [autoEmbed] });
        }

        const staffBypass = isStaffMember(message.member) ||
            message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages);

        // ================= ANTI PING =================
        let protectedPing = false;
        message.mentions.members.forEach(member => {
            if (ANTI_PING_MEMBERS.has(member.id)) protectedPing = true;
        });
        if (message.mentions.roles.has(ANTI_PING_ROLE_ID)) protectedPing = true;

        if (protectedPing && !staffBypass) {
            const userId = message.author.id;
            const now = Date.now();
            const data = antiPingAttempts.get(userId) || { count: 0, timestamp: now };
            if (now - data.timestamp > 60_000) {
                data.count = 0;
                data.timestamp = now;
            }
            data.count += 1;
            antiPingAttempts.set(userId, data);

            await message.delete().catch(() => {});

            if (data.count >= 3 && message.member?.moderatable) {
                await message.member.timeout(10 * 60_000, "Anti-Ping: repeated protected ping").catch(() => {});
                antiPingAttempts.delete(userId);

                await protectionLog(
                    message,
                    "Anti-Ping Timeout",
                    "Repeated ping of a protected member/role. 10-minute timeout applied.",
                    0xed4245,
                    [{ name: "Action", value: "🔇 10 minute timeout", inline: true }]
                );
                await sendProtectionNotice(message, "Protected Ping Blocked", "Repeated protected ping detected. A **10 minute timeout** was applied.", 0xed4245);
            } else {
                const remaining = Math.max(0, 3 - data.count);
                await protectionLog(message, "Protected Ping Blocked", "Pinged a protected member or role.");
                await sendProtectionNotice(message, "Protected Ping Blocked", `Do not ping protected staff/members. **${remaining}** attempt(s) remain before a 10-minute timeout.`);
            }
            return;
        }

        if (staffBypass) return;

        // ================= ANTI LINK =================
        if (antiLinkChannels.has(message.channel.id)) {
            const hasLink = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(message.content);
            if (hasLink) {
                await message.delete().catch(() => {});
                const violations = recordProtectionViolation(message.author.id, "link");
                await protectionLog(message, "Link Blocked", "A link was posted in an anti-link protected channel.", 0xe67e22, [
                    { name: "Recent Violations", value: String(violations), inline: true }
                ]);
                await sendProtectionNotice(message, "Link Blocked", "Links are not allowed in this channel.");
                return;
            }
        }

        // ================= ANTI MASS MENTION =================
        if (antiMentionChannels.has(message.channel.id)) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount >= MENTION_LIMIT || message.mentions.everyone) {
                await message.delete().catch(() => {});
                const violations = recordProtectionViolation(message.author.id, "mention");

                if (violations >= 2 && message.member?.moderatable) {
                    await message.member.timeout(5 * 60_000, "Anti-Mass-Mention protection").catch(() => {});
                }

                await protectionLog(message, "Mass Mention Blocked", `Detected ${mentionCount} user/role mention(s)${message.mentions.everyone ? " plus @everyone/@here" : ""}.`, violations >= 2 ? 0xed4245 : 0xe67e22, [
                    { name: "Threshold", value: String(MENTION_LIMIT), inline: true },
                    { name: "Recent Violations", value: String(violations), inline: true },
                    { name: "Action", value: violations >= 2 ? "5 minute timeout" : "Message removed", inline: true }
                ]);
                await sendProtectionNotice(
                    message,
                    "Mass Mention Blocked",
                    violations >= 2 ? "Repeated mass mentioning detected. A **5 minute timeout** was applied." : "Too many mentions in one message."
                );
                return;
            }
        }

        // ================= ANTI SPAM =================
        if (antiSpamChannels.has(message.channel.id)) {
            const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
            const now = Date.now();
            const history = (spamTracker.get(key) || []).filter(ts => now - ts <= SPAM_WINDOW_MS);
            history.push(now);
            spamTracker.set(key, history);

            if (history.length >= SPAM_LIMIT) {
                await message.delete().catch(() => {});
                spamTracker.set(key, []);
                const violations = recordProtectionViolation(message.author.id, "spam");
                const timedOut = violations >= 2 && message.member?.moderatable;

                if (timedOut) {
                    await message.member.timeout(SPAM_TIMEOUT_MS, "Anti-Spam protection").catch(() => {});
                }

                await protectionLog(message, "Spam Detected", `${SPAM_LIMIT} messages were sent within approximately ${Math.round(SPAM_WINDOW_MS / 1000)} seconds.`, timedOut ? 0xed4245 : 0xe67e22, [
                    { name: "Recent Violations", value: String(violations), inline: true },
                    { name: "Action", value: timedOut ? `${Math.round(SPAM_TIMEOUT_MS / 60000)} minute timeout` : "Message removed", inline: true }
                ]);
                await sendProtectionNotice(
                    message,
                    "Spam Detected",
                    timedOut
                        ? `Repeated spam detected. A **${Math.round(SPAM_TIMEOUT_MS / 60000)} minute timeout** was applied.`
                        : "Please slow down. Repeated spam may trigger a timeout."
                );
            }
        }
    }
);

// =====================================================
// MESSAGE DELETE / EDIT LOGS
// =====================================================

client.on(
    Events.MessageDelete,
    async (message) => {
        if (!message.guild || message.author?.bot || !LOG_CHANNELS.MSG) return;

        const attachments = message.attachments?.size
            ? Array.from(message.attachments.values())
                .map(a => `[${a.name || "Attachment"}](${a.url})`)
                .join("\n")
            : "None";

        const embed = makeLogEmbed({
            title: "Message Deleted",
            color: 0xed4245,
            emoji: "🗑️",
            user: message.author
        }).addFields(
            { name: "👤 Author", value: userLabel(message.author), inline: false },
            { name: "💬 Channel", value: formatChannel(message.channel), inline: false },
            { name: "🆔 Message ID", value: `\`${message.id}\``, inline: true },
            { name: "📝 Content", value: trimText(message.content || "No text content / message was uncached", 1024), inline: false },
            { name: "📎 Attachments", value: trimText(attachments, 1024), inline: false }
        );

        await sendLog(message.guild, LOG_CHANNELS.MSG, embed);
    }
);

client.on(
    Events.MessageUpdate,
    async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot || !LOG_CHANNELS.MSG) return;
        if (oldMessage.content === newMessage.content) return;

        const embed = makeLogEmbed({
            title: "Message Edited",
            color: 0xfee75c,
            emoji: "✏️",
            user: oldMessage.author
        }).addFields(
            { name: "👤 Author", value: userLabel(oldMessage.author), inline: false },
            { name: "💬 Channel", value: formatChannel(oldMessage.channel), inline: false },
            { name: "🔗 Message", value: `[Jump to Message](${newMessage.url}) • \`${newMessage.id}\``, inline: false },
            { name: "⬅️ Before", value: trimText(oldMessage.content || "No text content / uncached", 1024), inline: false },
            { name: "➡️ After", value: trimText(newMessage.content || "No text content", 1024), inline: false }
        );

        await sendLog(oldMessage.guild, LOG_CHANNELS.MSG, embed);
    }
);

// =====================================================
// VOICE CHANNEL LOG
// =====================================================

client.on(
    Events.VoiceStateUpdate,
    async (oldState, newState) => {
        if (!LOG_CHANNELS.VC) return;

        const member = newState.member || oldState.member;
        if (!member) return;

        const fields = [
            { name: "👤 Member", value: userLabel(member.user), inline: false }
        ];
        let title = "Voice State Updated";
        let emoji = "🎙️";
        let color = 0x3498db;

        if (oldState.channelId !== newState.channelId) {
            if (!oldState.channelId && newState.channelId) {
                title = "Voice Channel Joined";
                emoji = "📥";
                color = 0x57f287;
            } else if (oldState.channelId && !newState.channelId) {
                title = "Voice Channel Left";
                emoji = "📤";
                color = 0xed4245;
            } else {
                title = "Voice Channel Switched";
                emoji = "🔄";
                color = 0x5865f2;
            }

            fields.push(
                { name: "From", value: oldState.channel ? formatChannel(oldState.channel) : "Not in voice", inline: true },
                { name: "To", value: newState.channel ? formatChannel(newState.channel) : "Not in voice", inline: true }
            );
        }

        const stateChanges = [];
        const addChange = (label, oldValue, newValue) => {
            if (oldValue !== newValue) stateChanges.push(`${label}: **${oldValue ? "On" : "Off"} → ${newValue ? "On" : "Off"}**`);
        };
        addChange("Self Mute", oldState.selfMute, newState.selfMute);
        addChange("Self Deaf", oldState.selfDeaf, newState.selfDeaf);
        addChange("Server Mute", oldState.serverMute, newState.serverMute);
        addChange("Server Deaf", oldState.serverDeaf, newState.serverDeaf);
        addChange("Streaming", oldState.streaming, newState.streaming);
        addChange("Camera", oldState.selfVideo, newState.selfVideo);

        if (stateChanges.length) {
            fields.push({ name: "Voice Status Changes", value: stateChanges.join("\n"), inline: false });
        }

        if (oldState.channelId === newState.channelId && !stateChanges.length) return;

        const embed = makeLogEmbed({
            title,
            color,
            emoji,
            user: member.user
        }).addFields(fields);

        await sendLog(newState.guild, LOG_CHANNELS.VC, embed);
    }
);

// =====================================================
// MEMBER UPDATE • ROLE + NICKNAME LOGS
// =====================================================

client.on(
    Events.GuildMemberUpdate,
    async (oldMember, newMember) => {
        if (LOG_CHANNELS.ROLE) {
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;
            const added = newRoles.filter(r => !oldRoles.has(r.id));
            const removed = oldRoles.filter(r => !newRoles.has(r.id));

            if (added.size || removed.size) {
                const executor = await getRecentAuditExecutor(
                    newMember.guild,
                    AuditLogEvent.MemberRoleUpdate,
                    newMember.id
                );

                const embed = makeLogEmbed({
                    title: "Member Roles Updated",
                    color: 0x9b59b6,
                    emoji: "🎭",
                    user: newMember.user
                }).addFields(
                    { name: "👤 Member", value: userLabel(newMember.user), inline: false },
                    {
                        name: "➕ Added",
                        value: added.size ? trimText(added.map(r => `${r} • \`${r.id}\``).join("\n"), 1024) : "None",
                        inline: false
                    },
                    {
                        name: "➖ Removed",
                        value: removed.size ? trimText(removed.map(r => `${r} • \`${r.id}\``).join("\n"), 1024) : "None",
                        inline: false
                    },
                    { name: "🛡️ Changed By", value: executor ? userLabel(executor) : "Unknown / bot could not read audit log", inline: false }
                );

                await sendLog(newMember.guild, LOG_CHANNELS.ROLE, embed);
            }
        }

        if (LOG_CHANNELS.NICKNAME && oldMember.nickname !== newMember.nickname) {
            const executor = await getRecentAuditExecutor(
                newMember.guild,
                AuditLogEvent.MemberUpdate,
                newMember.id
            );

            const embed = makeLogEmbed({
                title: "Nickname Changed",
                color: 0xfee75c,
                emoji: "🏷️",
                user: newMember.user
            }).addFields(
                { name: "👤 Member", value: userLabel(newMember.user), inline: false },
                { name: "⬅️ Old Nickname", value: trimText(oldMember.nickname || "None", 1024), inline: true },
                { name: "➡️ New Nickname", value: trimText(newMember.nickname || "None", 1024), inline: true },
                { name: "🛡️ Changed By", value: executor ? userLabel(executor) : "Unknown / self-change / audit log unavailable", inline: false }
            );

            await sendLog(newMember.guild, LOG_CHANNELS.NICKNAME, embed);
        }
    }
);

// =====================================================
// SERVER / CHANNEL / ROLE / INVITE STRUCTURE LOGS
// =====================================================

client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (!LOG_CHANNELS.SERVER) return;

    const changes = [];
    if (oldGuild.name !== newGuild.name) changes.push(`**Name:** ${oldGuild.name} → ${newGuild.name}`);
    if (oldGuild.icon !== newGuild.icon) changes.push("**Server Icon:** changed");
    if (oldGuild.banner !== newGuild.banner) changes.push("**Server Banner:** changed");
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`**Verification:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
    if (oldGuild.preferredLocale !== newGuild.preferredLocale) changes.push(`**Preferred Locale:** ${oldGuild.preferredLocale} → ${newGuild.preferredLocale}`);
    if (!changes.length) return;

    const embed = makeLogEmbed({
        title: "Server Settings Updated",
        color: 0x5865f2,
        emoji: "⚙️",
        description: trimText(changes.join("\n"), 3900),
        footer: `Server ID: ${newGuild.id} • SAM STUDIO`
    }).setThumbnail(newGuild.iconURL({ extension: "png", size: 256, forceStatic: false }));

    await sendLog(newGuild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.ChannelCreate, async channel => {
    if (!channel.guild || !LOG_CHANNELS.SERVER) return;
    const embed = makeLogEmbed({
        title: "Channel Created",
        color: 0x57f287,
        emoji: "➕"
    }).addFields(
        { name: "Channel", value: formatChannel(channel), inline: false },
        { name: "Type", value: `\`${channel.type}\``, inline: true },
        { name: "Category", value: channel.parent ? formatChannel(channel.parent) : "None", inline: false }
    );
    await sendLog(channel.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.ChannelDelete, async channel => {
    if (!channel.guild || !LOG_CHANNELS.SERVER) return;
    const embed = makeLogEmbed({
        title: "Channel Deleted",
        color: 0xed4245,
        emoji: "➖"
    }).addFields(
        { name: "Channel", value: `\`${channel.name || "Unknown"}\` • \`${channel.id}\``, inline: false },
        { name: "Type", value: `\`${channel.type}\``, inline: true },
        { name: "Category", value: channel.parent ? `\`${channel.parent.name}\`` : "None", inline: true }
    );
    await sendLog(channel.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!newChannel.guild || !LOG_CHANNELS.SERVER) return;
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`**Category:** ${oldChannel.parent?.name || "None"} → ${newChannel.parent?.name || "None"}`);
    if ("topic" in oldChannel && oldChannel.topic !== newChannel.topic) changes.push("**Topic:** changed");
    if (!changes.length) return;

    const embed = makeLogEmbed({
        title: "Channel Updated",
        color: 0xfee75c,
        emoji: "📝",
        description: trimText(changes.join("\n"), 3900)
    }).addFields({ name: "Channel", value: formatChannel(newChannel), inline: false });
    await sendLog(newChannel.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.GuildRoleCreate, async role => {
    if (!LOG_CHANNELS.SERVER) return;
    const embed = makeLogEmbed({
        title: "Server Role Created",
        color: role.color || 0x57f287,
        emoji: "🎭"
    }).addFields(
        { name: "Role", value: `${role} • \`${role.name}\` • \`${role.id}\``, inline: false },
        { name: "Position", value: String(role.position), inline: true },
        { name: "Managed", value: role.managed ? "Yes" : "No", inline: true }
    );
    await sendLog(role.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.GuildRoleDelete, async role => {
    if (!LOG_CHANNELS.SERVER) return;
    const embed = makeLogEmbed({
        title: "Server Role Deleted",
        color: 0xed4245,
        emoji: "🎭"
    }).addFields(
        { name: "Role", value: `\`${role.name}\` • \`${role.id}\``, inline: false },
        { name: "Position", value: String(role.position), inline: true }
    );
    await sendLog(role.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    if (!LOG_CHANNELS.SERVER) return;
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);
    if (oldRole.color !== newRole.color) changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push("**Permissions:** changed");
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Display separately:** ${oldRole.hoist ? "On" : "Off"} → ${newRole.hoist ? "On" : "Off"}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${oldRole.mentionable ? "On" : "Off"} → ${newRole.mentionable ? "On" : "Off"}`);
    if (!changes.length) return;

    const embed = makeLogEmbed({
        title: "Server Role Updated",
        color: newRole.color || 0xfee75c,
        emoji: "🎭",
        description: trimText(changes.join("\n"), 3900)
    }).addFields({ name: "Role", value: `${newRole} • \`${newRole.id}\``, inline: false });
    await sendLog(newRole.guild, LOG_CHANNELS.SERVER, embed);
});

client.on(Events.InviteCreate, async invite => {
    const guild = invite.guild?.id ? client.guilds.cache.get(invite.guild.id) : null;
    if (!guild) return;
    invites.set(`${guild.id}:${invite.code}`, invite.uses || 0);

    if (LOG_CHANNELS.INVITE) {
        const embed = makeLogEmbed({
            title: "Invite Created",
            color: 0x57f287,
            emoji: "🔗",
            user: invite.inviter
        }).addFields(
            { name: "Code", value: `\`${invite.code}\``, inline: true },
            { name: "Created By", value: invite.inviter ? userLabel(invite.inviter) : "Unknown", inline: false },
            { name: "Channel", value: invite.channel ? formatChannel(invite.channel) : "Unknown", inline: false },
            { name: "Max Uses", value: invite.maxUses ? String(invite.maxUses) : "Unlimited", inline: true },
            { name: "Expires", value: invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:F>` : "Never", inline: true }
        );
        await sendLog(guild, LOG_CHANNELS.INVITE, embed);
    }
});

client.on(Events.InviteDelete, async invite => {
    const guild = invite.guild?.id ? client.guilds.cache.get(invite.guild.id) : null;
    if (!guild) return;
    invites.delete(`${guild.id}:${invite.code}`);

    if (LOG_CHANNELS.INVITE) {
        const embed = makeLogEmbed({
            title: "Invite Deleted",
            color: 0xed4245,
            emoji: "🔗"
        }).addFields(
            { name: "Code", value: `\`${invite.code}\``, inline: true },
            { name: "Channel", value: invite.channel ? formatChannel(invite.channel) : "Unknown", inline: false }
        );
        await sendLog(guild, LOG_CHANNELS.INVITE, embed);
    }
});

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

        let inviteInfo = null;
        try {
            const guildInvites = await member.guild.invites.fetch();
            let usedInvite = null;
            let largestIncrease = 0;

            guildInvites.forEach(invite => {
                const key = `${member.guild.id}:${invite.code}`;
                const oldUses = invites.get(key) || 0;
                const increase = (invite.uses || 0) - oldUses;
                if (increase > largestIncrease) {
                    largestIncrease = increase;
                    usedInvite = invite;
                }
            });

            guildInvites.forEach(invite => {
                invites.set(`${member.guild.id}:${invite.code}`, invite.uses || 0);
            });

            if (usedInvite?.inviter) {
                const inviter = usedInvite.inviter;
                const stats = inviteStats[inviter.id] || { joins: 0, leaves: 0 };
                stats.joins = Number(stats.joins || 0) + 1;
                stats.leaves = Number(stats.leaves || 0);
                inviteStats[inviter.id] = stats;
                memberInviters[member.id] = {
                    guildId: member.guild.id,
                    inviterId: inviter.id,
                    code: usedInvite.code,
                    joinedAt: Date.now()
                };
                saveBotState();

                inviteInfo = {
                    inviter,
                    code: usedInvite.code,
                    uses: usedInvite.uses || 0,
                    expiresAt: usedInvite.expiresTimestamp || null
                };
            }
        } catch (error) {
            console.warn(`[INVITES] Could not resolve invite for ${member.user.tag}:`, error.message);
        }

        if (LOG_CHANNELS.INVITE) {
            const inviteLog = makeLogEmbed({
                title: inviteInfo ? "Member Joined via Invite" : "Member Joined • Invite Unknown",
                color: inviteInfo ? 0x57f287 : 0xfee75c,
                emoji: "📨",
                user: member.user
            }).addFields(
                { name: "New Member", value: userLabel(member.user), inline: false },
                { name: "Inviter", value: inviteInfo ? userLabel(inviteInfo.inviter) : "Unknown / vanity / deleted / unavailable invite", inline: false },
                { name: "Invite Code", value: inviteInfo ? `\`${inviteInfo.code}\`` : "Unknown", inline: true },
                { name: "Invite Uses", value: inviteInfo ? String(inviteInfo.uses) : "Unknown", inline: true },
                { name: "Server Members", value: String(member.guild.memberCount), inline: true },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\n<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
            );
            await sendLog(member.guild, LOG_CHANNELS.INVITE, inviteLog);
        }

        if (LOG_CHANNELS.JOIN) {
            const joinLog = makeLogEmbed({
                title: "Member Joined Server",
                color: 0x57f287,
                emoji: "📥",
                user: member.user
            }).addFields(
                { name: "Member", value: userLabel(member.user), inline: false },
                { name: "Member Count", value: `**${member.guild.memberCount}**`, inline: true },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: "Invite", value: inviteInfo ? `\`${inviteInfo.code}\` by ${inviteInfo.inviter}` : "Unknown", inline: false }
            );
            await sendLog(member.guild, LOG_CHANNELS.JOIN, joinLog);
        }
    }
);

// =====================================================
// MEMBER LEAVE
// =====================================================

client.on(
    Events.GuildMemberRemove,
    async (member) => {
        const tracked = memberInviters[member.id];
        let inviterUser = null;

        if (tracked?.guildId === member.guild.id && tracked.inviterId) {
            const stats = inviteStats[tracked.inviterId] || { joins: 0, leaves: 0 };
            stats.joins = Number(stats.joins || 0);
            stats.leaves = Number(stats.leaves || 0) + 1;
            inviteStats[tracked.inviterId] = stats;
            inviterUser = await client.users.fetch(tracked.inviterId).catch(() => null);
            delete memberInviters[member.id];
            saveBotState();
        }

        if (GOODBYE_CHANNEL_ID) {
            const channel = member.guild.channels.cache.get(GOODBYE_CHANNEL_ID);
            if (channel) {
                const embed = makeLogEmbed({
                    title: "Goodbye",
                    color: 0xed4245,
                    emoji: "👋",
                    user: member.user,
                    description: `**${member.user.tag}** has left **${member.guild.name}**.`,
                    footer: "SAM STUDIO"
                }).addFields(
                    { name: "Member", value: `${member.user} • \`${member.id}\``, inline: false },
                    { name: "Members Remaining", value: `**${member.guild.memberCount}**`, inline: true }
                );
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        if (LOG_CHANNELS.JOIN) {
            const leaveLog = makeLogEmbed({
                title: "Member Left Server",
                color: 0xed4245,
                emoji: "📤",
                user: member.user
            }).addFields(
                { name: "Member", value: userLabel(member.user), inline: false },
                { name: "Joined Server", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Unknown", inline: false },
                { name: "Members Remaining", value: `**${member.guild.memberCount}**`, inline: true },
                { name: "Originally Invited By", value: inviterUser ? userLabel(inviterUser) : tracked?.inviterId ? `<@${tracked.inviterId}> • \`${tracked.inviterId}\`` : "Unknown", inline: false }
            );
            await sendLog(member.guild, LOG_CHANNELS.JOIN, leaveLog);
        }

        if (LOG_CHANNELS.INVITE && tracked?.inviterId) {
            const stats = inviteStats[tracked.inviterId] || { joins: 0, leaves: 0 };
            const inviteLog = makeLogEmbed({
                title: "Invited Member Left",
                color: 0xe67e22,
                emoji: "📨",
                user: member.user
            }).addFields(
                { name: "Member", value: userLabel(member.user), inline: false },
                { name: "Inviter", value: inviterUser ? userLabel(inviterUser) : `<@${tracked.inviterId}> • \`${tracked.inviterId}\``, inline: false },
                { name: "Invite Code", value: tracked.code ? `\`${tracked.code}\`` : "Unknown", inline: true },
                { name: "Inviter Tracked Joins", value: String(stats.joins || 0), inline: true },
                { name: "Inviter Tracked Leaves", value: String(stats.leaves || 0), inline: true }
            );
            await sendLog(member.guild, LOG_CHANNELS.INVITE, inviteLog);
        }
    }
);

// =====================================================
// GIVEAWAY ENGINE
// =====================================================

async function getGiveawayParticipants(message) {
    const reaction = message.reactions.cache.get("🎉") ||
        await message.reactions.resolve("🎉");
    if (!reaction) return [];

    const users = await reaction.users.fetch().catch(() => null);
    if (!users) return [];
    return users.filter(user => !user.bot).map(user => user.id);
}

function chooseWinners(participants, count) {
    const pool = [...new Set(participants)];
    const winners = [];
    while (pool.length && winners.length < count) {
        const index = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(index, 1)[0]);
    }
    return winners;
}

async function endGiveaway(messageId, { forcedBy = null } = {}) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return "❌ Active giveaway not found.";

    const channel = client.channels.cache.get(giveaway.channelId) ||
        await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
        activeGiveaways.delete(messageId);
        saveBotState();
        return "❌ Giveaway channel no longer exists.";
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
        activeGiveaways.delete(messageId);
        saveBotState();
        return "❌ Giveaway message no longer exists.";
    }

    const participants = await getGiveawayParticipants(message);
    const winnerIds = chooseWinners(participants, Number(giveaway.winners || 1));
    const winnerMentions = winnerIds.map(id => `<@${id}>`);
    const endedAt = Date.now();

    const endedEmbed = makeLogEmbed({
        title: "Giveaway Ended",
        color: winnerIds.length ? 0x5865f2 : 0xed4245,
        emoji: "🎉",
        description: `**Prize**\n${trimText(giveaway.prize, 500)}`,
        footer: `Hosted by ${giveaway.hostId ? `User ${giveaway.hostId}` : "Unknown"} • SAM STUDIO Giveaways`
    }).addFields(
        { name: "🏆 Winners", value: winnerMentions.length ? winnerMentions.join(", ") : "No valid participants", inline: false },
        { name: "👥 Participants", value: String(participants.length), inline: true },
        { name: "📅 Ended", value: `<t:${Math.floor(endedAt / 1000)}:F>`, inline: true }
    );

    await message.edit({ embeds: [endedEmbed] }).catch(() => {});

    if (winnerMentions.length) {
        await channel.send({
            content: `🎉 Congratulations ${winnerMentions.join(", ")}! You won **${giveaway.prize}**.`,
            allowedMentions: { parse: [], users: winnerIds, roles: [] }
        }).catch(() => {});
    } else {
        await channel.send({
            embeds: [makeLogEmbed({
                title: "Giveaway Ended",
                color: 0xed4245,
                emoji: "🎉",
                description: `No valid participants entered **${giveaway.prize}**.`,
                footer: "SAM STUDIO • Giveaways"
            })]
        }).catch(() => {});
    }

    const guild = channel.guild;
    const forcedUser = forcedBy || null;
    const log = makeLogEmbed({
        title: forcedBy ? "Giveaway Ended Early" : "Giveaway Completed",
        color: 0x5865f2,
        emoji: "🎉",
        user: forcedUser
    }).addFields(
        { name: "Prize", value: trimText(giveaway.prize, 1024), inline: false },
        { name: "Channel", value: formatChannel(channel), inline: false },
        { name: "Message", value: `[Open Giveaway](${message.url}) • \`${message.id}\``, inline: false },
        { name: "Participants", value: String(participants.length), inline: true },
        { name: "Winners", value: winnerMentions.length ? winnerMentions.join(", ") : "None", inline: false },
        { name: "Ended By", value: forcedUser ? userLabel(forcedUser) : "Automatic timer", inline: false }
    );
    await sendLog(guild, LOG_CHANNELS.MOD, log);

    activeGiveaways.delete(messageId);
    saveBotState();
    return winnerIds.length
        ? `✅ Giveaway ended. Winner(s): ${winnerMentions.join(", ")}`
        : "✅ Giveaway ended with no valid participants.";
}

async function rerollGiveaway(guild, currentChannel, messageId, winnersCount, moderator) {
    const active = activeGiveaways.get(messageId);
    let channel = active?.channelId
        ? guild.channels.cache.get(active.channelId) || await guild.channels.fetch(active.channelId).catch(() => null)
        : currentChannel;

    if (!channel?.isTextBased()) return "❌ Giveaway channel not found.";
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return "❌ Giveaway message not found in this channel.";

    const participants = await getGiveawayParticipants(message);
    if (!participants.length) return "❌ No valid participants to reroll.";

    const winnerIds = chooseWinners(participants, winnersCount);
    const winnerMentions = winnerIds.map(id => `<@${id}>`);

    await channel.send({
        content: `🔁 **Giveaway Reroll:** ${winnerMentions.join(", ")}`,
        embeds: [makeLogEmbed({
            title: "Giveaway Winners Rerolled",
            color: 0x5865f2,
            emoji: "🔁",
            description: `Selected **${winnerIds.length}** new winner(s) from **${participants.length}** participant(s).`,
            footer: `Rerolled by ${moderator.tag}`
        })],
        allowedMentions: { parse: [], users: winnerIds, roles: [] }
    }).catch(() => {});

    const log = makeLogEmbed({
        title: "Giveaway Rerolled",
        color: 0x5865f2,
        emoji: "🔁",
        user: moderator
    }).addFields(
        { name: "Moderator", value: userLabel(moderator), inline: false },
        { name: "Message", value: `[Open Giveaway](${message.url}) • \`${message.id}\``, inline: false },
        { name: "New Winners", value: winnerMentions.join(", "), inline: false }
    );
    await sendLog(guild, LOG_CHANNELS.MOD, log);

    return `✅ Rerolled winner(s): ${winnerMentions.join(", ")}`;
}

async function processActiveGiveaways() {
    const now = Date.now();
    for (const [messageId, giveaway] of activeGiveaways) {
        if (!giveaway?.endTime || giveaway.endTime > now) continue;
        await endGiveaway(messageId).catch(error => {
            console.error(`[GIVEAWAY] Could not end ${messageId}:`, error.message);
        });
    }
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
