/**
 * Command Definition System
 * This allows commands to be defined using cmd({ ... }, async (...) => { ... })
 * to maintain compatibility with different command styles in the project.
 */

if (!global.cmdRegistry) {
    global.cmdRegistry = new Map();
}

function cmd(info, handler) {
    const command = {
        ...info,
        handler: handler
    };
    
    const name = info.pattern || info.name || info.command;
    if (name) {
        global.cmdRegistry.set(name, command);
        if (info.alias) {
            const aliases = Array.isArray(info.alias) ? info.alias : [info.alias];
            aliases.forEach(a => global.cmdRegistry.set(a, command));
        }
        if (info.aliases) {
            const aliases = Array.isArray(info.aliases) ? info.aliases : [info.aliases];
            aliases.forEach(a => global.cmdRegistry.set(a, command));
        }
    }
    return command;
}

module.exports = { cmd, commands: global.cmdRegistry };
