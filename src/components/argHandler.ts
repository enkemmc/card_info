export default handleArgs

function handleArgs() {
    const args = process.argv.slice(2)

    const commands = {
        update: () => {
            require('./update_data.js').update_data()
        },
        test: () => console.log('success!')
    }

    for (const arg of args) {
        if (commands[arg]) commands[arg]()
    }
}