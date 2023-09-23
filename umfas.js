const path = require("path")

const { proto, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys")

const { s3, headObject, deleteObject } = require('./db.js')

module.exports = async (folder, Bucket) => {
    const fixFileName = file => file.replace(/\//g, '__').replace(/:/g, '-')
    const writeData = async (data, file) => {
        var Key = path.join(folder, fixFileName(file))
        return await s3.putObject({
                  Bucket, Key, Body: JSON.stringify(data, BufferJSON.replacer)
        }).promise()
    }
    const readData = async (file) => {
        try {
            var Key = path.join(folder, fixFileName(file))
            var data = await s3.getObject({Key, Bucket}).promise()
            return JSON.parse(data.Body.toString(), BufferJSON.reviver)
        }
        catch (error) {
            return null;
        }
    };
    const removeData = async (file) => {
        try {
            var Key = path.join(folder, fixFileName(file))
            return await deleteObject({Key, Bucket})
        }
        catch (x) {
        }
    }
    const creds = await readData('creds.json') || initAuthCreds()
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`)
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value)
                        }
                        data[id] = value
                    }))
                    return data
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id]
                            const file = `${category}-${id}.json`
                            tasks.push(value ? writeData(value, file) : removeData(file))
                        }
                    }
                    await Promise.all(tasks)
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds.json')
        }
    }
}
