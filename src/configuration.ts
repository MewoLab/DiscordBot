/**
 * @description Test a condition
 * @param condition Condition to test.
 * @param error Error text.
 * @returns true if condition is true.
 */
const assert = (condition: any, error: string): true => {
    if (condition) return true
    throw new Error(error)
}

/**
 * @description Match English words with their boolean counterpart (["y", "yes", "true"])
 * @param s string to check
 * @returns true if string is a common way to define a variable as true
 */
const yes = (s?: string) => {
    switch (s?.trim()?.toLowerCase()) {
        case "y":
        case "yes":
        case "true":
            return true
        default:
            return false
    }
}

const Configuration = {
    discord: {
        token:
            assert(process.env.DISCORD_TOKEN, "DISCORD_TOKEN not present!") &&
            process.env.DISCORD_TOKEN!,
        should_reregister_commands: yes(process.env.REGISTER_ENV),
    },
    emit: {
        log_level: (() => {
            switch (process.env.LOG_LEVEL) {
                case "silly":
                    return 0
                case "trace":
                    return 1
                case "debug":
                    return 2
                case "info":
                    return 3
                case "warn":
                    return 4
                case "error":
                    return 5
                case "fatal":
                    return 6
                default:
                    return 3
            }
        })(),
    },
    // ...removed starboard configuration...
}

export default Configuration
