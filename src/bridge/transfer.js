import { BS, Util, _, SelfClass } from 'dovemaxsdk'

// -----------------------------------------------------------------
// 交互处理
const AgentClient = BS.b$.AgentClient
const AgentServer = BS.b$.AgentServer

const __$p$ = {
  // 针对前端使用者，我要启动后端服务 {启动后，所有数据信息都转向后端服务编码来处理}
  backAgent: new AgentServer(),
  startBackAgent: () => {
    const agent = __$p$.backAgent
    agent.active({

    })
  },
  // 针对前端使用者，我要启动前端服务，{启动后，可以根据发送信息、接收信息方式与后端服务来交互}
  frontAgent: new AgentClient(),
  startFrontAgent: () => {
    const agent = __$p$.frontAgent
    const wsSocketIO = new agent.Chancel()
    wsSocketIO.build({
      type: agent.ChancelType.websocketForNode,
      ip: 'localhost',
      port: '8888',
      protocol: 'http://',
      reqUrl: '',
      clientIOType: 'Socket.io.client'
    })
    agent.registerOnFinishBuildChannel(() => {
      __$p$.isRunning = true
    })
    agent.appendChancel(wsSocketIO)
  },

  isRunning: false,
  run: (startBackAgent = true) => {
    console.log('start transfer.js ....')
    if (startBackAgent) {
      __$p$.startBackAgent()
    }
    __$p$.startFrontAgent()
    return __$p$
  },

  send: (message, handler, one = true) => {
    __$p$.frontAgent.registerOnReceiveFromServer(handler, one)
    __$p$.frontAgent.noticeToServer(message)
    return __$p$
  }
}

//  绑定工具
__$p$.Tools = {
  Hello: (handler, one = false) => {
    __$p$.send({ data: 'Hello' }, data => {
      handler(data)
    }, one)
  },
  Fix: {
    Image: {
      run: (options = {}, handler, one = false) => {
        const debugMode = true
        if (debugMode === false) {
          const info = {
            taskID: options.taskID, // 任务ID
            cli: '',                // 动态调用的模块
            reload: false,          // 默认是false, 支持热部署, 是否重新加载动态模块
            command: [              // 命令
              { action: '' }
            ]
          }

          __$p$.send(info, data => {
            handler(data)
          }, one)
        } else {
          handler()
        }
      },
      chancel: (options = {}, handler, one = false) => {
        const debugMode = true
        if (debugMode === false) {
          __$p$.send({ data: options }, data => {
            handler(data)
          }, one)
        } else {
          handler()
        }
      }
    }
  }

}

const TransferClass = SelfClass.extend(__$p$)
const Transfer = new TransferClass()
Transfer.run(false)

window.RomanysoftClient = Transfer
export {
  Transfer
}

