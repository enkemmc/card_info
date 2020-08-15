import path from 'path'
import https from 'https'
import fs from 'fs'
import stream from 'stream'
import util from 'util'

const pipeline = util.promisify(stream.pipeline)
const out_filepath = process.env.data as string || path.join(__dirname, '..','data', 'data.json') as string

export function file_exists(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.access(out_filepath, fs.constants.F_OK, err => {
            if (!err) {
                resolve(true)
            } else {
                resolve(false)
            }
        })
    })
}
export function update_data(): Promise<void> {
    return new Promise((resolve, reject) => {
        const json_url = `https://mtgjson.com/files/AllPrintings.json`

        try {
            https.get(json_url, async response => {
                let out_filepath = process.env.data as string || path.join(__dirname, 'data', 'data.json') as string
                console.log(`downloading to ${out_filepath}`)
                const write_stream = fs.createWriteStream(out_filepath)
                await pipeline(response, write_stream)

                const data = fs.readFileSync(out_filepath, { encoding: 'utf8' })
                const output = JSON.stringify(JSON.parse(data), null, 3)
                fs.writeFileSync(out_filepath, output)
                console.log('download complete')
                resolve()
            })
        } catch (e) {
            reject(e)
        }
    })
}
