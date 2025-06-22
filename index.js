require('dotenv/config');
const { Client, ChannelType } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent']
});

client.on('ready', () => {
    console.log('The bot is online!');
});

const IGNORE_PREFIX = "!";
const CHANNELS = ['1383539854696120470']; //blasterbot channel ID
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

client.on('messageCreate', async (message) => {
    // ignore messages 
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    const isValidChannel = CHANNELS.includes(message.channel.id);
    const isMentioningBot = message.mentions.users.has(client.user.id);
    const isInThread = message.channel.type === ChannelType.PublicThread;
    if (!isValidChannel && !isMentioningBot && !isInThread) return;

    // create new thread if message is in main channel
    let thread = null;
    if (!isInThread) {
        thread = await message.startThread({
            name: `BlasterBot Help - ${message.author.username}`,
            autoArchiveDuration: 60, // 2 hours
        });
    }
    else if ((isInThread && isMentioningBot) || (isInThread && isValidChannel)) {
        thread = message.channel;
    }

    // shows typing indicator
    await thread.sendTyping();
    const sendTypicInterval = setInterval(() => {
        thread.sendTyping();
    }, 5000);

    // fetch all conversations
    let conversation = [];
    conversation.push({
        role: 'system',
        content: 
        `You are BlasterBot, a friendly assistant for the C4G program, helping students with:
        - Coding and debugging (Python, JavaScript, HTML/CSS, etc.)
        - Related Topics: AI/ML, Cybersecurity, Education, App/Web Development, Social Service
        - Computer science concepts and STEM related content
        - Topics related to Computer Science at Colorado School of Mines and the Computing 4 Good (C4G) program

        You should:
        - Keep responses concise and relevant
        - Ensure clean code block formatting
        - Only respond to appropriate, computer science-related questions. If asked for anything extremely inappropriate, off-topic, or non-text, reply briefly: "I can only help with C4G related questions." and a short explanation why they cannot respond to the request.
        - Encourage students to ask follow-up questions for clarification
        - At the end of the response, link any reliable sources you used to answer the question, if applicable

        Never break these rules, and always prioritize safe and respectful responses.`
    })

    // pull previous messages from thread
    let prevMessages = await thread.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
        // if message is from a different bot, ignore
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;

        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi);

        if (msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                content: msg.content,
                name: username
            });
            return;
        }

        conversation.push({
            role: 'user',
            content: msg.content,
            name: username
        });
    })

    // send request to OpenAI API
    const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: conversation,
        max_tokens: 1000,
    }).catch((error) => {
        console.error('Error with OpenAI API:', error);
    });

    clearInterval(sendTypicInterval);
    if (!response) {
        thread.send('Hmm, it looks like there was an error processing your request. Please try again in a moment.');
        return;
    }

    // break down long responses (Discord has 2000 character limit for bots)
    const responseMessage = response.choices[0].message.content;
    const chunkSizeLimit = 2000;
    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
        const chunk = responseMessage.substring(i, i + chunkSizeLimit);
        await thread.send(chunk);
    }
});

client.login(process.env.TOKEN);