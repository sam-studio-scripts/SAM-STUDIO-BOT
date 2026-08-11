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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder,
    Events,
    MessageFlags
} = require("discord.js");

// ================= CONFIG & ENV =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PANEL_CHANNEL_ID = "1526597563736916028";
const STAFF_ROLE_ID = "1536565026075181128";
const VERIFIED_ROLE_ID = "1526597473970294914";
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL;
const GOODBYE_CHANNEL_ID = process.env.GOODBYE_CHANNEL;
const CLOSED_CATEGORY_ID = "1536545669270077460";
const STORE_URL = "https://sam-studio.tebex.store/";

// Log Channels
const LOG_CHANNELS = {
    MOD: process.env.MOD_LOGS,
    TICKET: process.env.TICKET_LOGS,
    MSG: process.env.MESSAGE_LOGS,
    VC: process.env.VC_LOGS,
    JOIN: process.env.JOIN_LEAVE_LOGS,
    ROLE: process.env.ROLE_LOGS,
    SERVER: process.env.SERVER_LOGS,
    INVITE: process.env.INVITE_LOGS,
    NICKNAME: process.env.NICKNAME_LOGS
};

// ================= TICKET CATEGORIES =================
// Agar .env me IDs nahi doge to bot khud category
// name se find/create kar dega.

const CATEGORY_IDS = {
    purchase: process.env.PURCHASE_CATEGORY_ID || null,
    general_support: process.env.GENERAL_SUPPORT_CATEGORY_ID || null,
    premium_support: process.env.PREMIUM_SUPPORT_CATEGORY_ID || null,
    purchase_mlo: process.env.PURCHASE_MLO_CATEGORY_ID || null,
    purchase_ped: process.env.PURCHASE_PED_CATEGORY_ID || null
};

const CATEGORY_NAMES = {
    purchase: "Purchase",
    general_support: "General Support",
    premium_support: "Premium Support",
    purchase_mlo: "Purchase MLO",
    purchase_ped: "Purchase Ped"
};

const TICKET_LABELS = {
    purchase: "Purchase",
    general_support: "General Support",
    premium_support: "Premium Support",
    purchase_mlo: "Purchase MLO",
    purchase_ped: "Purchase Ped"
};

// Emojis
const EMOJIS = {
    purchase: "🛒",
    general_support: "🛠️",
    premium_support: "💎",
    purchase_mlo: "🏠",
    purchase_ped: "🧍"
};

// ================= TICKET IMAGES =================
const SMALL_IMAGE =
    "https://cdn.discordapp.com/attachments/1533736092610859028/1536546430334795837/C-_Users_WILAYA1_AppData_Local_Temp_Layer-1.png?ex=6a7bcbe0&is=6a7a7a60&hm=1bd59b2f732df993da14e7ff8ed333ca8225777dca7b8ea97c57c267dafdf5f2&";

const TICKET_IMAGE =
    "https://cdn.discordapp.com/attachments/1533736092610859028/1536546340245602455/ChatGPT_Image_Jul_22_2026_02_37_49_AM.png?ex=6a7bcbcb&is=6a7a7a4b&hm=f5720415b49b1b1aad26b1156bc4e3d5225d5fc32ee701b04eb6fdc55ad106e2&";

// ================= DATA STORES =================
let warnings = {};
let activeGiveaways = new Map();
let invites = new Map();
let ticketSequence = 0;

// ================= ANTI PING =================
const ANTI_PING_MEMBERS = new Set();
const ANTI_PING_ROLE_ID = "890136671050424340";
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

    const fallbackType = "general_support";

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
// PREMIUM TICKET HELPERS
// =====================================================

const TICKET_STATUS = {
    waiting_staff: {
        label: "🟡 Waiting for Staff",
        prefix: "wait"
    },
    in_progress: {
        label: "🔵 In Progress",
        prefix: "work"
    },
    waiting_customer: {
        label: "🟠 Waiting for Customer",
        prefix: "customer"
    },
    solved: {
        label: "🟢 Solved",
        prefix: "solved"
    },
    closed: {
        label: "🔒 Closed",
        prefix: "closed"
    }
};

const TICKET_TYPE_SLUG = {
    purchase: "purchase",
    general_support: "support",
    premium_support: "premium",
    purchase_mlo: "mlo",
    purchase_ped: "ped"
};

function cleanChannelName(value) {
    return String(value || "user")
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) || "user";
}

function getTicketMeta(channel) {
    const topic = channel?.topic || "";

    const read = (key) => {
        const match = topic.match(new RegExp(`${key}:([^|]+)`));
        return match?.[1] || null;
    };

    return {
        type: read("sam-ticket-type") || "general_support",
        userId: read("sam-ticket-user"),
        ticketId: read("sam-ticket-id") || String(channel?.id || "0000").slice(-4),
        status: read("sam-ticket-status") || "waiting_staff",
        claimedBy: read("sam-ticket-claimed") || "none"
    };
}

async function updateTicketMeta(channel, patch = {}) {
    const current = getTicketMeta(channel);
    const next = {
        ...current,
        ...patch
    };

    const topic = [
        `sam-ticket-type:${next.type}`,
        `sam-ticket-user:${next.userId || "unknown"}`,
        `sam-ticket-id:${next.ticketId}`,
        `sam-ticket-status:${next.status}`,
        `sam-ticket-claimed:${next.claimedBy || "none"}`
    ].join("|");

    await channel.setTopic(topic).catch(() => {});
    return next;
}

function getNextTicketId() {
    ticketSequence += 1;
    return String(ticketSequence).padStart(4, "0");
}

async function getTicketOpener(channel, meta = getTicketMeta(channel)) {
    if (meta.userId && meta.userId !== "unknown") {
        const member = await channel.guild.members.fetch(meta.userId).catch(() => null);
        if (member) return member;
    }

    return getTicketCreator(channel);
}

async function renameTicketChannel(channel, meta) {
    const opener = await getTicketOpener(channel, meta);
    const username = cleanChannelName(opener?.user?.username || meta.userId || "user");
    const statusPrefix = TICKET_STATUS[meta.status]?.prefix || "wait";
    const typeSlug = TICKET_TYPE_SLUG[meta.type] || "ticket";
    const newName = `${statusPrefix}-${meta.ticketId}-${typeSlug}-${username}`.slice(0, 100);

    if (channel.name !== newName) {
        await channel.setName(newName).catch(() => {});
    }
}

function buildTicketModal(type) {
    const label = TICKET_LABELS[type] || "Support";
    const modal = new ModalBuilder()
        .setCustomId(`modal_${type}`)
        .setTitle(`${EMOJIS[type] || "🎫"} ${label} Form`);

    if (type === "purchase") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("product_name")
                    .setLabel("Script / Product Name")
                    .setPlaceholder("Example: SAM Admin / Custom Script / Bundle")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("purchase_details")
                    .setLabel("What do you need?")
                    .setPlaceholder("Tell us what you want to purchase or customize...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
    } else if (type === "general_support") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("help")
                    .setLabel("How can we help?")
                    .setPlaceholder("Explain your issue in detail...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
    } else if (type === "premium_support") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("script_name")
                    .setLabel("Script Name")
                    .setPlaceholder("Example: SAM Admin / SAM Ped Menu")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("order_id")
                    .setLabel("Order ID (Optional)")
                    .setPlaceholder("Tebex/order ID if available")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("issue")
                    .setLabel("Issue / Error")
                    .setPlaceholder("Paste the error and explain what is happening...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
    } else if (type === "purchase_mlo") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("mlo_name")
                    .setLabel("MLO Name / Type")
                    .setPlaceholder("Example: Valentine Saloon / Custom House")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("mlo_requirements")
                    .setLabel("MLO Requirements / Details")
                    .setPlaceholder("Describe the MLO you want...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("mlo_reference")
                    .setLabel("MLO Reference / Link (Optional)")
                    .setPlaceholder("Paste reference link if available")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
    } else if (type === "purchase_ped") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("ped_name")
                    .setLabel("Ped Name / Type")
                    .setPlaceholder("Example: Male Custom Ped / Female Ped")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("ped_requirements")
                    .setLabel("Ped Requirements / Details")
                    .setPlaceholder("Describe clothes, face, style, etc...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("ped_reference")
                    .setLabel("Ped Reference / Link (Optional)")
                    .setPlaceholder("Paste image/reference link if available")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
    }

    return modal;
}

function buildTicketControls(meta) {
    const claimed = meta.claimedBy && meta.claimedBy !== "none";

    const claimRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel(claimed ? "Claimed" : "Claim")
            .setEmoji("🙋")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(claimed),
        new ButtonBuilder()
            .setCustomId("ticket_unclaim")
            .setLabel("Unclaim")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!claimed),
        new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Close")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
    );

    const statusRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_status_waiting_staff")
            .setLabel("Waiting Staff")
            .setEmoji("🟡")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_status_in_progress")
            .setLabel("In Progress")
            .setEmoji("🔵")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ticket_status_waiting_customer")
            .setLabel("Waiting Customer")
            .setEmoji("🟠")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("ticket_solved")
            .setLabel("Solved")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success)
    );

    return [claimRow, statusRow];
}

function buildClosedControls() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_reopen")
                .setLabel("Reopen")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("ticket_delete")
                .setLabel("Delete")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

async function fetchAllTicketMessages(channel) {
    const all = [];
    let before = null;

    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {})
        });

        if (!batch.size) break;

        all.push(...batch.values());
        before = batch.last().id;

        if (batch.size < 100 || all.length >= 2000) break;
    }

    return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function makeTranscript(channel, messages, meta) {
    const lines = [
        "SAM STUDIO Ticket Transcript",
        `Ticket ID: #${meta.ticketId}`,
        `Type: ${TICKET_LABELS[meta.type] || meta.type}`,
        `Opener ID: ${meta.userId || "Unknown"}`,
        `Claimed By: ${meta.claimedBy && meta.claimedBy !== "none" ? meta.claimedBy : "Not Claimed"}`,
        `Status: ${TICKET_STATUS[meta.status]?.label || meta.status}`,
        `Channel: ${channel.name}`,
        `Generated: ${new Date().toLocaleString()}`,
        ""
    ];

    for (const message of messages) {
        const author = message.author?.tag || "Unknown User";
        const content = message.content || "[No text content]";
        const attachmentLinks = [...message.attachments.values()]
            .map(a => a.url)
            .join(" ");

        lines.push(
            `[${message.createdAt.toLocaleString()}] ${author}: ${content}${attachmentLinks ? ` | Attachments: ${attachmentLinks}` : ""}`
        );
    }

    return Buffer.from(lines.join("\n"), "utf-8");
}

async function refreshTicketControlMessage(channel, meta) {
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (!messages) return;

    const controlMessage = messages.find(msg =>
        msg.author?.id === client.user.id &&
        msg.components.some(row =>
            row.components.some(component => component.customId === "ticket_claim")
        )
    );

    if (!controlMessage) return;

    const existingEmbed = controlMessage.embeds[0]
        ? EmbedBuilder.from(controlMessage.embeds[0])
        : new EmbedBuilder().setTitle("SAM STUDIO Ticket");

    const existingFields = (existingEmbed.data.fields || []).filter(field =>
        !["Status", "Claimed By"].includes(field.name)
    );

    existingEmbed.setFields(
        ...existingFields,
        {
            name: "Status",
            value: TICKET_STATUS[meta.status]?.label || meta.status,
            inline: true
        },
        {
            name: "Claimed By",
            value: meta.claimedBy && meta.claimedBy !== "none"
                ? `<@${meta.claimedBy}>`
                : "Not Claimed",
            inline: true
        }
    );

    await controlMessage.edit({
        embeds: [existingEmbed],
        components: buildTicketControls(meta)
    }).catch(() => {});
}

async function sendRatingRequest(member, guildId, ticketId) {
    if (!member) return;

    const ratingRow = new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(score =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate:${guildId}:${ticketId}:${score}`)
                .setLabel(`${score}★`)
                .setStyle(score >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
    );

    await member.send({
        content: `⭐ **SAM STUDIO Support Rating**\nHow was the support for ticket **#${ticketId}**?`,
        components: [ratingRow]
    }).catch(() => {});
}

async function closeTicket(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.channel;
    let meta = getTicketMeta(channel);
    const opener = await getTicketOpener(channel, meta);

    const messages = await fetchAllTicketMessages(channel).catch(() => []);
    const transcript = makeTranscript(channel, messages, meta);

    if (opener) {
        await opener.send({
            content: `📄 **Your SAM STUDIO Ticket Transcript** — Ticket #${meta.ticketId}`,
            files: [
                {
                    attachment: transcript,
                    name: `transcript-${meta.ticketId}.txt`
                }
            ]
        }).catch(() => {});
    }

    meta = await updateTicketMeta(channel, {
        status: "closed"
    });

    await channel.setParent(CLOSED_CATEGORY_ID).catch(() => {});

    if (meta.userId && meta.userId !== "unknown") {
        await channel.permissionOverwrites.edit(meta.userId, {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true
        }).catch(() => {});
    }

    await renameTicketChannel(channel, meta);

    if (interaction.message) {
        await interaction.message.edit({ components: [] }).catch(() => {});
    }

    const closedEmbed = new EmbedBuilder()
        .setColor("#E74C3C")
        .setTitle(`🔒 Ticket #${meta.ticketId} Closed`)
        .setDescription(`Closed by <@${interaction.user.id}>.\nThe opener can still read this channel but cannot send messages.`)
        .setTimestamp();

    await channel.send({
        embeds: [closedEmbed],
        components: buildClosedControls()
    }).catch(() => {});

    const log = new EmbedBuilder()
        .setColor("#E74C3C")
        .setTitle("Ticket Closed")
        .addFields(
            { name: "Ticket", value: `#${meta.ticketId}`, inline: true },
            { name: "Channel", value: channel.name, inline: true },
            { name: "Closed By", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);
    await sendRatingRequest(opener, interaction.guild.id, meta.ticketId);

    if (interaction.deferred) {
        return interaction.editReply("✅ Ticket closed. Transcript sent to the opener if DMs are available.");
    }
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
        .setDescription("Send formatted embed message")
        .addStringOption(o =>
            o.setName("channel_id")
                .setDescription("Channel ID")
                .setRequired(true)
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

        // Initialize next ticket number from existing ticket topics
        client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                const match = channel.topic?.match(/sam-ticket-id:(\d+)/);
                if (match) {
                    ticketSequence = Math.max(ticketSequence, Number(match[1]) || 0);
                }
            });
        });

        console.log(`Ticket Counter Ready: next ticket will be #${String(ticketSequence + 1).padStart(4, "0")}`);

        // Invite tracker setup

        const guild =
            client.guilds.cache.first();

        if (guild) {

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
                // TICKET PANEL - BUTTON SYSTEM
                // =================================================

                if (cmd === "ticketpanel") {

                    if (interaction.channelId !== PANEL_CHANNEL_ID) {
                        return interaction.reply({
                            content: "Wrong channel ♻️",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("SAM STUDIO • RedM Support")
                        .setColor(0x2b2d31)
                        .setDescription(
                            "**Premium RedM Scripts, MLOs & Custom Peds**\n" +
                            "Select an option below and our team will assist you."
                        )
                        .setThumbnail(SMALL_IMAGE)
                        .setImage(TICKET_IMAGE)
                        .setFooter({
                            text: "SAM STUDIO • RedM Scripts & Services"
                        });

                    const ticketButtonsRow1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket_open_purchase")
                            .setLabel("Purchase Script")
                            .setEmoji("🛒")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("ticket_open_premium_support")
                            .setLabel("Premium Support")
                            .setEmoji("💎")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("ticket_open_general_support")
                            .setLabel("General Support")
                            .setEmoji("🛠️")
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const ticketButtonsRow2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket_open_purchase_mlo")
                            .setLabel("Purchase MLO")
                            .setEmoji("🏠")
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId("ticket_open_purchase_ped")
                            .setLabel("Purchase Ped")
                            .setEmoji("🧍")
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setLabel("Visit Store")
                            .setEmoji("🌐")
                            .setStyle(ButtonStyle.Link)
                            .setURL(STORE_URL)
                    );

                    return interaction.reply({
                        embeds: [embed],
                        components: [ticketButtonsRow1, ticketButtonsRow2]
                    });
                }

                // ================= INVITES =================

                if (cmd === "invites") {
                    const target = interaction.options.getMember("user") || interaction.member;

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    try {
                        const guildInvites = await interaction.guild.invites.fetch();
                        const ownedInvites = guildInvites.filter(invite => invite.inviter?.id === target.id);
                        const totalUses = ownedInvites.reduce((sum, invite) => sum + (invite.uses || 0), 0);
                        const activeCodes = ownedInvites
                            .map(invite => `\`${invite.code}\` — ${invite.uses || 0} use(s)`)
                            .slice(0, 10)
                            .join("\n") || "No active invite links.";

                        const embed = new EmbedBuilder()
                            .setTitle(`📊 Invite Stats - ${target.user.tag}`)
                            .setColor(0x2b2d31)
                            .addFields(
                                { name: "Current Uses", value: String(totalUses), inline: true },
                                { name: "Active Links", value: String(ownedInvites.size), inline: true },
                                { name: "Invite Codes", value: activeCodes }
                            )
                            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }));

                        return interaction.editReply({ embeds: [embed] });
                    } catch (e) {
                        return interaction.editReply("❌ Unable to fetch invites. Check bot invite permissions.");
                    }
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

                if (cmd === "msg") {

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

                    const channelId =
                        interaction.options.getString(
                            "channel_id"
                        );

                    const modal =
                        new ModalBuilder()

                            .setCustomId(
                                `modal_msg_${channelId}`
                            )

                            .setTitle(
                                "Send Message"
                            );

                    const input =
                        new TextInputBuilder()

                            .setCustomId(
                                "msg_content"
                            )

                            .setLabel(
                                "Message Content"
                            )

                            .setStyle(
                                TextInputStyle.Paragraph
                            )

                            .setRequired(
                                true
                            );

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(
                                input
                            )
                    );

                    return interaction.showModal(
                        modal
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

            if (interaction.isModalSubmit()) {

                // ================= MSG MODAL =================

                if (interaction.customId.startsWith("modal_msg_")) {
                    const chanId = interaction.customId.replace("modal_msg_", "");
                    const content = interaction.fields.getTextInputValue("msg_content");
                    const channel = client.channels.cache.get(chanId);

                    if (!channel) {
                        return interaction.reply({
                            content: "Invalid Channel ID",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor("#8B0000")
                        .setDescription(content);

                    await channel.send({ embeds: [embed] });

                    return interaction.reply({
                        content: "✅ Formatted message sent!",
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Only ticket modals continue below
                if (!interaction.customId.startsWith("modal_")) return;

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const type = interaction.customId.replace("modal_", "");

                if (!CATEGORY_NAMES[type]) {
                    return interaction.editReply("❌ Invalid ticket type.");
                }

                if (await hasOpenTicket(interaction.guild, interaction.user.id, type)) {
                    return interaction.editReply({
                        content: "❌ You already have an open ticket for this category!"
                    });
                }

                const ticketCategory = await getTicketCategory(interaction.guild, type);
                const ticketId = getNextTicketId();
                const cleanUsername = cleanChannelName(interaction.user.username);
                const typeSlug = TICKET_TYPE_SLUG[type] || "ticket";

                const ticketChannel = await interaction.guild.channels.create({
                    name: `wait-${ticketId}-${typeSlug}-${cleanUsername}`.slice(0, 100),
                    type: ChannelType.GuildText,
                    parent: ticketCategory.id,
                    topic:
                        `sam-ticket-type:${type}|` +
                        `sam-ticket-user:${interaction.user.id}|` +
                        `sam-ticket-id:${ticketId}|` +
                        `sam-ticket-status:waiting_staff|` +
                        `sam-ticket-claimed:none`,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.EmbedLinks
                            ]
                        },
                        {
                            id: STAFF_ROLE_ID,
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

                const formFields = [];

                interaction.fields.fields.forEach(f => {
                    const safeValue = String(f.value || "N/A").slice(0, 900);
                    formFields.push({
                        name: f.customId.toUpperCase().replace(/_/g, " "),
                        value: `\`\`\`${safeValue}\`\`\``
                    });
                });

                const meta = getTicketMeta(ticketChannel);

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setTitle(`${EMOJIS[type] || "🎫"} ${TICKET_LABELS[type] || "Support"} Ticket #${ticketId}`)
                    .setDescription(
                        `Thank you for contacting **SAM STUDIO**.\n` +
                        `Our staff team will assist you shortly.`
                    )
                    .addFields(
                        { name: "Ticket", value: `#${ticketId}`, inline: true },
                        { name: "Customer", value: `<@${interaction.user.id}>`, inline: true },
                        { name: "Department", value: TICKET_LABELS[type] || "Support", inline: true },
                        { name: "Status", value: TICKET_STATUS.waiting_staff.label, inline: true },
                        { name: "Assigned", value: "Not Claimed", inline: true },
                        ...formFields
                    )
                    .setFooter({
                        text: `Opened by ${interaction.user.tag} • SAM STUDIO`
                    })
                    .setTimestamp();

                await ticketChannel.send({
                    content:
                        `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>\n\n` +
                        `**Ticket #${ticketId} opened successfully. A staff member will assist you soon.**`,
                    embeds: [embed],
                    components: buildTicketControls(meta)
                });

                const log = new EmbedBuilder()
                    .setColor("#3498DB")
                    .setTitle("Ticket Created")
                    .addFields(
                        { name: "Ticket", value: `#${ticketId}`, inline: true },
                        { name: "User", value: interaction.user.tag, inline: true },
                        { name: "Channel", value: `<#${ticketChannel.id}>`, inline: true },
                        { name: "Type", value: TICKET_LABELS[type] || type.toUpperCase() }
                    )
                    .setTimestamp();

                await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);

                return interaction.editReply(`✅ Ticket Created: ${ticketChannel}`);
            }

            // =================================================
            // BUTTON HANDLER
            // =================================================

            if (interaction.isButton()) {

                // =================================================
                // RATING BUTTONS (DM SAFE)
                // =================================================

                if (interaction.customId.startsWith("ticket_rate:")) {
                    const [, guildId, ticketId, scoreRaw] = interaction.customId.split(":");
                    const score = Number(scoreRaw);
                    const guild = client.guilds.cache.get(guildId);

                    if (!guild || !Number.isInteger(score) || score < 1 || score > 5) {
                        return interaction.reply({
                            content: "❌ Invalid rating.",
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                    }

                    const ratingLog = new EmbedBuilder()
                        .setColor(score >= 4 ? "#2ECC71" : "#F1C40F")
                        .setTitle("⭐ Support Rating")
                        .addFields(
                            { name: "Ticket", value: `#${ticketId}`, inline: true },
                            { name: "Customer", value: interaction.user.tag, inline: true },
                            { name: "Rating", value: `${score}/5 ⭐`, inline: true }
                        )
                        .setTimestamp();

                    await sendLog(guild, LOG_CHANNELS.TICKET, ratingLog);

                    return interaction.update({
                        content: `✅ Thanks! You rated ticket **#${ticketId}** **${score}/5 ⭐**.`,
                        components: []
                    });
                }

                // =================================================
                // OPEN TICKET BUTTONS
                // =================================================

                if (interaction.customId.startsWith("ticket_open_")) {
                    const type = interaction.customId.replace("ticket_open_", "");

                    if (!CATEGORY_NAMES[type]) {
                        return interaction.reply({
                            content: "❌ Invalid ticket category.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    return interaction.showModal(buildTicketModal(type));
                }

                // Ticket controls below require a guild ticket channel
                if (!interaction.guild || !interaction.channel) return;

                const meta = getTicketMeta(interaction.channel);
                const isStaff = interaction.member?.roles?.cache?.has(STAFF_ROLE_ID);
                const isOpener = meta.userId === interaction.user.id;

                // =================================================
                // CLAIM
                // =================================================

                if (interaction.customId === "ticket_claim") {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (meta.claimedBy && meta.claimedBy !== "none") {
                        return interaction.reply({
                            content: `❌ This ticket is already claimed by <@${meta.claimedBy}>.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updated = await updateTicketMeta(interaction.channel, {
                        claimedBy: interaction.user.id,
                        status: "in_progress"
                    });

                    await renameTicketChannel(interaction.channel, updated);
                    await refreshTicketControlMessage(interaction.channel, updated);

                    await interaction.channel.send(
                        `🙋 **Ticket #${updated.ticketId} claimed by <@${interaction.user.id}>.**`
                    ).catch(() => {});

                    const log = new EmbedBuilder()
                        .setColor("#2ECC71")
                        .setTitle("Ticket Claimed")
                        .addFields(
                            { name: "Ticket", value: `#${updated.ticketId}`, inline: true },
                            { name: "Staff Member", value: interaction.user.tag, inline: true }
                        )
                        .setTimestamp();

                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);
                    return interaction.editReply("✅ Ticket claimed.");
                }

                // =================================================
                // UNCLAIM
                // =================================================

                if (interaction.customId === "ticket_unclaim") {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updated = await updateTicketMeta(interaction.channel, {
                        claimedBy: "none",
                        status: "waiting_staff"
                    });

                    await renameTicketChannel(interaction.channel, updated);
                    await refreshTicketControlMessage(interaction.channel, updated);

                    await interaction.channel.send(
                        `↩️ **Ticket #${updated.ticketId} is now unclaimed and waiting for staff.**`
                    ).catch(() => {});

                    return interaction.editReply("✅ Ticket unclaimed.");
                }

                // =================================================
                // STATUS BUTTONS
                // =================================================

                if (interaction.customId.startsWith("ticket_status_")) {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const status = interaction.customId.replace("ticket_status_", "");

                    if (!TICKET_STATUS[status] || status === "closed" || status === "solved") {
                        return interaction.reply({
                            content: "❌ Invalid ticket status.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updated = await updateTicketMeta(interaction.channel, { status });
                    await renameTicketChannel(interaction.channel, updated);
                    await refreshTicketControlMessage(interaction.channel, updated);

                    await interaction.channel.send(
                        `📌 **Ticket #${updated.ticketId} status:** ${TICKET_STATUS[status].label}`
                    ).catch(() => {});

                    return interaction.editReply(`✅ Status changed to ${TICKET_STATUS[status].label}.`);
                }

                // =================================================
                // SOLVED CONFIRMATION
                // =================================================

                if (interaction.customId === "ticket_solved") {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updated = await updateTicketMeta(interaction.channel, {
                        status: "solved"
                    });

                    await renameTicketChannel(interaction.channel, updated);
                    await refreshTicketControlMessage(interaction.channel, updated);

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket_solve_close")
                            .setLabel("Yes, Close Ticket")
                            .setEmoji("✅")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("ticket_solve_keepopen")
                            .setLabel("Still Need Help")
                            .setEmoji("💬")
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await interaction.channel.send({
                        content:
                            `<@${updated.userId}> **has your issue been solved?**\n` +
                            `You can close the ticket or keep it open if you still need help.`,
                        components: [confirmRow]
                    });

                    return interaction.editReply("✅ Marked as solved. Waiting for customer confirmation.");
                }

                if (interaction.customId === "ticket_solve_keepopen") {
                    if (!isOpener && !isStaff) {
                        return interaction.reply({
                            content: "Only the ticket opener or staff can use this button.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const updated = await updateTicketMeta(interaction.channel, {
                        status: "waiting_staff"
                    });

                    await renameTicketChannel(interaction.channel, updated);
                    await refreshTicketControlMessage(interaction.channel, updated);

                    await interaction.update({
                        content: `💬 **Ticket #${updated.ticketId} remains open. Staff will continue helping.**`,
                        components: []
                    });

                    return;
                }

                if (interaction.customId === "ticket_solve_close") {
                    if (!isOpener && !isStaff) {
                        return interaction.reply({
                            content: "Only the ticket opener or staff can use this button.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    return closeTicket(interaction);
                }

                // =================================================
                // CLOSE
                // =================================================

                if (interaction.customId === "ticket_close") {
                    if (!isOpener && !isStaff) {
                        return interaction.reply({
                            content: "Only the ticket opener or staff can close this ticket.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    return closeTicket(interaction);
                }

                // =================================================
                // REOPEN
                // =================================================

                if (interaction.customId === "ticket_reopen") {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const originalCategory = await getTicketCategory(interaction.guild, meta.type);
                    await interaction.channel.setParent(originalCategory.id).catch(() => {});

                    if (meta.userId && meta.userId !== "unknown") {
                        await interaction.channel.permissionOverwrites.edit(meta.userId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            AttachFiles: true,
                            EmbedLinks: true
                        }).catch(() => {});
                    }

                    const updated = await updateTicketMeta(interaction.channel, {
                        status: "waiting_staff",
                        claimedBy: "none"
                    });

                    await renameTicketChannel(interaction.channel, updated);
                    await interaction.message.edit({ components: [] }).catch(() => {});

                    const reopenEmbed = new EmbedBuilder()
                        .setColor("#2ECC71")
                        .setTitle(`🔓 Ticket #${updated.ticketId} Reopened`)
                        .setDescription(
                            `<@${updated.userId}> can send messages again.\n` +
                            `The ticket is waiting for a staff member.`
                        )
                        .setTimestamp();

                    await interaction.channel.send({
                        embeds: [reopenEmbed],
                        components: buildTicketControls(updated)
                    });

                    const log = new EmbedBuilder()
                        .setColor("#2ECC71")
                        .setTitle("Ticket Reopened")
                        .addFields(
                            { name: "Ticket", value: `#${updated.ticketId}`, inline: true },
                            { name: "Reopened By", value: interaction.user.tag, inline: true },
                            { name: "Ticket Type", value: TICKET_LABELS[updated.type] || updated.type }
                        )
                        .setTimestamp();

                    await sendLog(interaction.guild, LOG_CHANNELS.TICKET, log);
                    return interaction.editReply("✅ Ticket reopened.");
                }

                // =================================================
                // DELETE
                // =================================================

                if (interaction.customId === "ticket_delete") {
                    if (!isStaff) {
                        return interaction.reply({
                            content: "Staff Only!",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const currentMeta = getTicketMeta(interaction.channel);
                    const messages = await fetchAllTicketMessages(interaction.channel).catch(() => []);
                    const transcript = makeTranscript(interaction.channel, messages, currentMeta);

                    const log = new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("Ticket Deleted")
                        .addFields(
                            { name: "Ticket", value: `#${currentMeta.ticketId}`, inline: true },
                            { name: "Channel", value: interaction.channel.name, inline: true },
                            { name: "Deleted By", value: interaction.user.tag, inline: true }
                        )
                        .setTimestamp();

                    const ticketLogChan = interaction.guild.channels.cache.get(LOG_CHANNELS.TICKET);

                    if (ticketLogChan) {
                        await ticketLogChan.send({
                            embeds: [log],
                            files: [
                                {
                                    attachment: transcript,
                                    name: `transcript-${currentMeta.ticketId}.txt`
                                }
                            ]
                        }).catch(() => {});
                    }

                    await interaction.editReply("🗑️ Ticket deleted.");
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

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "Welcome to SAM STUDIO | 2026!"
                        )

                        .setColor(
                            0x8B00FF
                        )

                        .setDescription(
                            `Hey ${member}, glad you found us!\nWe are happy to welcome you to SAM STUDIO.`
                        )

                        .setThumbnail(
                            member.user.displayAvatarURL({
                                dynamic:
                                    true
                            })
                        )

                        .setImage(
                            "https://discord.com/channels/884214421747007488/1533736092610859028/1536546340304068639"
                        )

                        .setFooter({
                            text:
                                "SAM STUDIO | 2026"
                        })

                        .setTimestamp();

                channel.send({
                    embeds: [
                        embed
                    ]
                }).catch(
                    () => {}
                );
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
    "SAM STUDIO Bot is ready with Button Tickets + Ticket Status + Claim/Unclaim + Solved Flow + Ratings + All Logs!"
);

client.login(
    TOKEN
).catch(
    console.error
);
