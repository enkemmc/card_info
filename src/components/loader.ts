import fs from 'fs'
import net from 'net'
import { EventEmitter } from 'events'
import * as models from './models'
import { update_data } from '../components/update_data'

interface AppConfig {
    targetSet: keyof models.RawData
}

export class App extends EventEmitter {
    data: models.RawData
    config: AppConfig
    // idToCard: Map<number, models.Card>
    // inputToCard: Map<string, models.Card>

    constructor() {
        super()
        this.loadData()
        this.config = {
            targetSet: 'JMP'
        }

        this.emit('ready')
    }

    private loadData() {
        console.log('loading data')
        const carddata = fs.readFileSync(process.env.data, { encoding: 'utf8' })
        this.data = JSON.parse(carddata) as models.RawData
        console.log('data loaded')
    }

    getSetnamePartialMatches(setName: string): string[] {
        const hits = []
        for (const [setCode, setdata] of Object.entries(this.data)) {
            if (setdata.name.toLowerCase().includes(setName.toLowerCase())) {
                hits.push(`${setCode} | ${setdata.name}`)
            }
        }
        return hits
    }

    lookupByName({ set, name }: { set: keyof models.RawData, name: string }): models.Card | models.Card[] {
        const similar = []
        for (const card of this.data[set].cards) {
            if (card.name.toLowerCase() === name.toLowerCase()) {
                return card
            } else if (card.name.toLowerCase().includes(name)) {
                similar.push(card)
            }
        }

        if (similar.length > 0) {
            return similar
        }

        // ignore set
        for (const [setName, set] of Object.entries(this.data).reverse()) {
            for (const card of set.cards) {
                if (card.name.toLocaleLowerCase() === name.toLowerCase()) {
                    return card
                } else if (card.name.toLowerCase().includes(name)) {
                    similar.push(card)
                }
            }
        }

        return similar
    }

    lookupById({ set, id }: { set: keyof models.RawData, id: number }) {
        for (const card of this.data[set].cards) {
            if (card.mtgArenaId === id) {
                return card
            }
        }

        // ignore set
        for (const [setName, set] of Object.entries(this.data).reverse()) {
            for (const card of set.cards) {
                if (card.mtgArenaId === id) {
                    return card
                }
            }
        }
    }

    async handleCommand(input: string): Promise<string> {
        const args = input.toLowerCase().split(' ')
        const command = args.shift()
        const commands = [
            { 
                name: 'help',
                description: 'lists all commands',
                usage: null
            },{
                name: 'update',
                description: 'downloads the latest data from the REST API',
                usage: null
            },{
                name: 'ls',
                description: 'lists all cards in this set. defaults to just their name. -l includes descriptions.',
                usage: 'ls -l'
            },{
                name: 'clear',
                description: 'does a bunch of newlines to clear out the console',
                usage: null
            },{
                name: 'set',
                description: 'set the default set to search',
                usage: null
            },{
                name: 'sets',
                description: 'list all set abbreviations paired with fullnames',
                usage: '!sets ahm'
            },{
                name: 'id',
                description: 'the id of the card',
                usage: '!id 215'
            },{
                name: 'name',
                description: 'name of the card',
                usage: '!name Bolas'
            },
        ]
        
        let response = ''

        switch (command) {
            case 'help':
                if (commands.length === 0) return response

                response += `**********\r\n`
                for (const  command of commands) {
                    const {name, description, usage } = command
                    response += `${name} - ${description}`
                    if (usage){
                        response += `${usage}\r\n`
                    }
                    response += `\r\n`
                }
                response += `**********\r\n`
                return response
            case 'update':
                await update_data()
                this.loadData()
                return response
            case 'ls':
                switch (args[0]) {
                    case 'l':
                        this.data[this.config.targetSet].cards.forEach((card, index) => {
                        response += `\r\n#${index} ${card.name} [${card.mtgArenaId}] ${card.manaCost}:\r\n`
                        response += `\r\n${card.text}\r\n`
                    })
                        return response
                    default:
                        this.data[this.config.targetSet].cards.forEach((card, index) => response += `${index}) ${card.name}\r\n`)
                        return response
                }
            case 'clear':
                for (let i = 0; i < 20; i++) {
                    response += `\r\n`
                }
                return response
            case 'set':
                if (args.length === 0) {
                    response += `set=${this.config.targetSet}\r\n`
                    return response
                }

                const new_setname = args[0].toUpperCase()
                if (typeof this.data[new_setname] !== 'undefined') {
                    this.config.targetSet = new_setname as keyof models.RawData
                    response += `SUCCESS: searching ${this.data[new_setname].name}\r\n`
                    return response
                } else {
                    response += `FAILED: unrecognized set: ${new_setname}\r\n`
                    return response
                }
            case 'sets':
                if (args.length === 0) {
                    response = Object.entries(this.data)
                        .reduce((str, [setname, setdata], index) => {
                            str.push(`${index}) ${setname} | ${setdata.name}`)
                            return str
                        }, [])
                        .join(`\r\n`)
                    response += `\r\n`
                    return response
                } else {
                    const partialMatches = this.getSetnamePartialMatches(args[0])
                    if (partialMatches.length === 0) {
                        return `no matches found for ${args[1]}`
                    } else {
                        return partialMatches.join(`\r\n`) + `\r\n`
                    }
                }
            case 'id':
                if (args.length === 0) {
                    response += `enter the card id`
                    return response
                } else {

                    const id = Number.parseInt(args[0])
                    if (Number.isNaN(id)) {
                        response += `id must be a number\r\n`
                        return response
                    } else {
                        const card = this.lookupById({ set: this.config.targetSet, id })
                        if (!card) {
                            response += `unable to find ${input}\n`
                            return response
                        } else {
                            response += `=====\r\n`
                            response += card.name + ' ' + card.manaCost + ' ' + `${card.type.includes('Creature') ? card.power + '/' + card.toughness : ''}` + ' ' + card.text + `\r\n`
                            response += `=====\r\n`
                            return response
                        }
                    }

                }
            case 'name':
                if (args.length === 0) {
                    response += 'enter part of the card name' + `\r\n`
                } else {
                    const name = args.join(" ")
                    const result = this.lookupByName({ set: this.config.targetSet, name })
                    if (!result) {
                        response += 'no matches found' + `\r\n`
                    } else if (!Array.isArray(result)) {
                        const card = result as models.Card
                        response += `=====\r\n`
                        response += card.name + ' ' + card.manaCost + ' ' + `${card.type.includes('Creature') ? card.power + '/' + card.toughness : ''}` + card.text + `\r\n`
                        response += `=====\r\n`
                    } else {
                        response += `=====\r\n`
                        response += `[${result.length}] matches:\r\n`
                        for (const card of result) {
                            response += card.mtgArenaId + ' ' + card.name + `\r\n`
                        }
                        response += `=====\r\n`
                    }
                }
                return response
            default:
                return `unrecognized command: ${input}\r\n`
        }
    }

    async listen() {

        // tcp stuff
        const listener = (c: net.Socket) => {
            console.log('client connected')
            c.on('end', () => {
                console.log('client disconnected')
            })
            c.write('connected to mtg card server\r\n')
            c.on('data', async data => {
                let input = data.toString()
                input = input.slice(0, input.length - 1)

                if (input[0] === '!') {
                    const response = await this.handleCommand(input.slice(1))
                    c.write(response)
                }
            })
        }

        const tcpServer = await startTcpServer(listener)

        console.log('listening for input:')
        process.stdin.setEncoding('utf8')
        process.stdin.on('readable', async () => {
            let input: string
            // Use a loop to make sure we read all available data.+
            while ((input = process.stdin.read()) !== null) {
                input = input.slice(0, input.length - 1)
                if (input[0] === '!') {
                    const output = await this.handleCommand(input.slice(1))
                    process.stdout.write(output)
                    continue
                }
            }
        })
    }
}

function startTcpServer(listener: (socket: net.Socket) => void): Promise<net.Server> {
    return new Promise((resolve, reject) => {
        const tcpServer = net.createServer(listener)
        tcpServer.on('error', err => {
            throw err
        })

        const defaultPort = 4000
        const port = parseInt(process.env.PORT) || defaultPort
        if (!process.env.PORT) {
            console.log(`PORT variable not set, so defaulting to ${defaultPort}`)
        }
        tcpServer.listen(port, () => {
            console.log(`tcp server listening on port ${port}`)
            resolve(tcpServer)
        })
    })


}
