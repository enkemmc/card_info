import { App } from './components/loader'
import { file_exists, update_data } from './components/update_data'
import path from 'path'
import fs from 'fs'

process.env.data = path.join(__dirname, 'data', 'data.json')

main()
async function main() {
    const exists = await file_exists()
    if (!exists){
        await update_data()
    }
    start()
}

function start() {
    const app = new App()
    app.listen()
}
