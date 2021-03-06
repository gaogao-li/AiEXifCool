<template>
    <section class="page page-app-doc">
        <div class="page__toolbar page__toolbar-app-doc">
            <ui-icon-button 
                @click="onToolBtnClick(index, item)"
                :type="item.type"
                :size="item.size" 
                :color="item.color"
                :key="item.id"
                v-if="item.visiable"
                v-for="item, index in actionList"
                >
                    <span :class="item.icon" :title="$t(item.tooltip)"></span>
            </ui-icon-button>

            <ui-confirm
                :autofocus="confirmDialog.autofocus"
                :confirm-button-text="confirmDialog.confirmButtonText"
                :deny-button-text="confirmDialog.denyButtonText"
                :ref="confirmDialog.ref"
                :title="confirmDialog.title"

                @confirm="onConfirmDialogConfirm"
                @deny="onConfirmDialogDeny"
            >
                {{ confirmDialog.content }}
            </ui-confirm>
        </div>

        <div class="page__examples page__examples-app-doc">
            <svg 
                :id="welcomeContentID"
                class="page__examples-app-doc__welcome"
                v-show="taskList.length <= 0"
                />

            <ui-alert 
                :class="getItemStyleClass(item)"
                @dismiss="onRemoveTaskItem(item, index)" removeIcon 
                :type="item.style.type" 
                v-show="item.style.show" 
                :key="item" 
                v-for="item, index in taskList">
                <div class="page__examples-app-doc__item">
                    <div class="ui-toolbar__top">
                        <div class="ui-toolbar__top__metainfo">
                            <img :src="item.thumb" width="48" height="48" viewBox="0 0 48 48" /> 
                            <strong class="ui-toolbar__top__fileName" :title=" $t('pages.repair.task-item.file-name') +  item.name"> 
                                {{ item.name }} 
                                <sup class="ui-toolbar__top__fileSize" :title=" $t('pages.repair.task-item.file-size') +  item.size ">
                                ({{ item.size }})
                                </sup>
                            </strong>
                        </div>
                        <div class="ui-toolbar__top__metainfo__toolbar">
                            <ui-icon-button 
                                @click="onOpenParentDir(item.fixOutDir)"
                                type="secondary"
                                color="white"
                                size="small"
                                v-if="item.stateInfo.state > 0"
                                >
                                <span class="fa fa-folder-open-o fa-lg fa-fw" :title=" $t('pages.repair.task-item.open-parent-dir') "></span>
                            </ui-icon-button>

                            <ui-icon-button 
                                @click="onPreviewFile(item.fixpath)"
                                type="secondary"
                                color="white"
                                size="small"
                                v-if="item.stateInfo.state > 0"
                                >
                                <span class="fa fa-eye fa-lg fa-fw" :title=" $t('pages.repair.task-item.review-in-file') "></span>
                            </ui-icon-button>
                        </div>


                    </div>
                    <div class="ui-toolbar__body">
                        <span
                            :class="['ui-toolbar__top__taskMessage', item.stateInfo.state < 0 ? 'task-item-has-error': '']"
                            :title="item.stateInfo.message"
                            v-show="item.stateInfo.state < 0"
                            >
                            {{ item.stateInfo.message }}
                        </span>
                        <span class="ui-toolbar__body__filePath" :title=" $t('pages.repair.task-item.file-path') + item.path">{{ item.path }}</span>
                    </div>
                    <div class="ui-toolbar__bottom">
                        <ui-progress-linear
                            :color="getItemProgressStyle(item)"
                            type="determinate"
                            :progress="item.progress"
                            v-show="getImageProgressShow(item)"
                            :title=" $t('pages.repair.task-item.progress') + item.progress"
                        ></ui-progress-linear>
                    </div>
                </div>
                
            </ui-alert>
        </div>

        <div :class=" ['page__footbar page__footbar-app-doc', {transferNormal: transferIsNormal}, {working: isFixworking}]" v-if="taskList.length >= 0">
            <span>{{ $t('pages.repair.footbar.fileCount') }} : {{ taskList.length }} </span>
            <span>{{ $t('pages.repair.footbar.state') }} : {{ isFixworking ? $t('pages.repair.footbar.isFixWorking') : $t('pages.repair.footbar.isWaiting') }} </span>
            <i :class="[isFixworking ? 'fa fa-spinner fa-spin fa-lg fa-fw':'fa fa-lg fa-fw' ]"/></i>
            <span>{{ $t('pages.repair.footbar.transferState') }} : {{ transferIsNormal ? $t('pages.repair.footbar.transferIsNormal') : $t('pages.repair.footbar.transferIsFault') }} </span>
        </div>
    </section>
</template>    

<script>
import { BS, Util, _ } from 'dove.max.sdk'
import {UiIcon, UiTabs, UiTab, UiConfirm, UiButton, UiIconButton, UiAlert, UiToolbar, UiProgressLinear} from 'keen-ui';
import {Transfer} from '../../bridge/transfer'


var baseID = "__page__repair__action__"
var baseIDIndex = -1

let taskList = [];
const taskPrefix = 'fixpage-image-id-' + _.now()
class Task {
    constructor(thumb, name, path, size){
        this.id = _.uniqueId(taskPrefix);
        this.thumb = thumb;   // 缩略图
        this.name = name;     // 图像文件名称
        this.path = path;     // 图像文件的路径
        this.size = size;     // 图像文件的存储大小

        /// ----- 展示样式相关
        this.style = {         
            show: true, 
            type: "success"
        };

        /// ----- 修复工作的情况
        this.isworking = false;     // 是否正在修复中
        this.progress = 0;          // 修复进度(100为单位)
        this.fixOutDir = "";        // 指定的修复输出目录
        this.fixpath = "";          // 修复成功的文件路径
        this.stateInfo = {           // 修复运行状态
            state: 0,               // 修复是否成功 0. 没有修复， 1，修复成功， -1修复失败
            message: ""             // 修复结果的描述，如果是错误，描述错误，如果是成功，描述其定义内容
        }
    }

}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
export default {
    
    data() {
        console.log("Repair.vue call data()")
        return {
            welcomeContentID:'page__repair__welcome__id',
            taskList: taskList,
            taskID2taskObj: {},
            isFixworking: false,
            transferIsNormal: Transfer.isRunning,  // Is transfer is working normal?
            progressInterval: null,  // 进度条轮询
            confirmDialog:{
                ref: 'default',
                autofocus: 'none',
                confirmButtonText: 'Confirm',
                denyButtonText: 'Deny',
                title: '',
                content: '',
                callbackConfirm: ()=>{},
                callbackDeny: ()=>{}
            }, 
            curFixTaskID: null       // 当前正在执行修复的整体任务ID
        }
    },

    beforeCreate(){
        var that = this
        console.log('Repair.vue beforeCreate')

        Transfer.frontAgent.registerOnChannelFault(function () {
            that.onTransferIsFault()
        })

        Transfer.frontAgent.registerOnFinishBuildChannel(function (){
            that.onTransferIsNoraml()
        })
    },
    mounted(){
        this.drawWelcome()
    },
    beforeDestroy() {
        clearInterval(this.progressInterval);
    },

    computed:{
        actionList() {
           var that = this
           return [
                {id:'action-import', visiable:true, color:"black", icon:"fa fa-file-image-o fa-lg fa-fw", size:"small", type:"secondary", tooltip:"pages.repair.toolbar.import"},
                {id:'action-importDir', visiable:true, color:"black", icon:"fa fa-folder-open-o fa-lg fa-fw", size:"small", type:"secondary", tooltip:"pages.repair.toolbar.importDir"},
                {id:'action-remove', visiable:true, color:"black", icon:"fa fa-trash-o fa-lg fa-fw", size:"small", type:"secondary", tooltip:"pages.repair.toolbar.remove"},
                {id:'action-do', visiable:!that.isFixworking, color:"green", icon:"fa fa-legal fa-lg fa-fw", size:"small", type:"secondary",  tooltip:"pages.repair.toolbar.fix"},
                {id:'action-stop', visiable:that.isFixworking, color:"red", icon:"fa fa-hand-paper-o fa-lg fa-fw", size:"small", type:"secondary",  tooltip:"pages.repair.toolbar.chancel"}
           ]
        }
    },

    methods:{
        // ------------------------- on Transfer Events
        onTransferIsNoraml() {
            var that = this
            that.transferIsNormal = true
        },
        onTransferIsFault(){
            var that = this
            that.transferIsNormal = false
            that.isFixworking = false

            // All task list run working
            that.stopFix()

        },

        // ------------------------- Welcome content
        drawWelcome(){
            var that = this
            var SnapRef = Util.util.getSnapSVG$()
            if (SnapRef) {
                var s = SnapRef('#' + that.welcomeContentID)

                // 创建一个盒子
                var rect = s.rect('8%', '8%', '84%', '84%', 16)
                rect.attr({
                    fill: "none",
                    "fill-opacity": 0.5,
                    "stroke-linecap": "round",
                    "stroke-linejoin": "bevel",
                    "stroke-dasharray" : "5,5",
                    stroke: "#adadad",
                    strokeWidth: 1
                })

                // 创建一个文字盒子
                var description = s.text('12%', '16%', that.$t('pages.repair.welcome.description'))
                var step1 = s.text('15%', '26%', that.$t('pages.repair.welcome.step1'))
                var step2 = s.text('15%', '36%', that.$t('pages.repair.welcome.step2'))
                var step3 = s.text('15%', '46%', that.$t('pages.repair.welcome.step3'))

                // 修饰一下文字
                description.attr({
                    "font-weight": "bold"
                })

            }
        },

        // ------------------------- Style
        getItemStyleClass(item){
            var _styleClass = ['']
            if (item.stateInfo) {
                
                if (item.stateInfo.state < 0) {
                    _styleClass = ['isFixFailed']
                }
                if (item.stateInfo.state > 0) {
                    _styleClass = ['isFixedSuccess']
                }
            }

            return _styleClass
        },

        getItemProgressStyle(item){
            var that = this
            var progressStyle = 'black' // item.stateInfo.state === 0
            if (item.stateInfo) {
                if (item.stateInfo.state < 0) progressStyle = 'accent'
                if (item.stateInfo.state > 0) progressStyle = 'primary'
            }

            return progressStyle
        },

        getImageProgressShow(item) {
            return item.isworking
        },

        // ------------------------- Confirm dialog
        onConfirmDialogConfirm(){
            var that = this
            const  fn = that.confirmDialog.callbackConfirm
            fn && fn()
        },
        onConfirmDialogDeny(){
            var that = this
            const  fn = that.confirmDialog.callbackDeny
            fn && fn()
        },

        // -------------------------- Tool bar
        onToolBtnClick(index, item){
            console.log('onToolBtnClick', index)

            if(item.id === 'action-import') {
                this.onBtnImportFilesClick()
            }else if (item.id === 'action-importDir') {
                this.onBtnImportDirClick()
            }else if (item.id === 'action-remove') {
                this.onBtnRemoveAllClick()
            }else if (item.id === 'action-do') {
                this.onBtnFixClick()
            }else if (item.id === 'action-stop') {
                this.onBtnStopFixClick()
            }
        },

        onBtnImportFilesClick(){
            var that = this

            const wwwPrefix = Transfer.getWWWAssetsUrlPrefix()
            console.log("-------------------- call import files")
            // call bs 
            BS.b$.importFiles({
                title: this.$t('pages.repair.dialog-import-images.title'),
                prompt: this.$t('pages.repair.dialog-import-images.prompt'),
                allowMulSelection: true,
                types:[] // Note: too many formats
            }, function(){ // Test code
                // Test[1]: Windows 本地实际数据
                _.each([
                    {fileName: 'RAW_NIKON_D7100.NEF', filePath:'D:\\TestResource\\exif_sample_images\\Nikon\\corrupted\\RAW_NIKON_D7100.NEF', fileSize: '27.5MB'},
                    {fileName: 'YDSC_0021.NEF', filePath:'D:\\TestResource\\exif_sample_images\\Nikon\\corrupted\\YDSC_0021.NEF', fileSize: '10.7MB'}
                ], function(ele){
                    let taskObj = new Task("images/picture.svg", ele.fileName, ele.filePath, ele.fileSize)
                    // let taskObj = new Task(wwwPrefix + "f6c4a7ea-0d48-4cbb-9d45-9e452c9fb0cd.jpg", ele.fileName, ele.filePath, ele.fileSize)
                    that.taskList.push(taskObj)
                    that.taskID2taskObj[taskObj.id] = taskObj

                    // get thubm from 
                    var srcImagesMap = {}
                    srcImagesMap[taskObj.id] = taskObj.path
                    Transfer.Tools.call('get.image.thumb', {
                        taskID: _.uniqueId('get-thumb-task-'),
                        data: {
                            src: srcImagesMap
                        },
                        lang: 'en'
                    }, (data) => {
                        if (data.msg_type === 's_task_exec_running') {
                            console.log('test_transfer.js getExifImageThumb running')
                        } else if (data.msg_type === 's_task_exec_feedback') {
                            const dataList = data.content
                            console.log('test_transfer.js  getExifImageThumb s_task_exec_feedback')
                            console.dir(dataList)
                        } else if (data.msg_type === 's_task_exec_result') {
                            const dataList = data.content
                            console.log('test_transfer.js getExifImageThumb s_task_exec_result')
                            console.dir(dataList)

                            // 分解获取到的数据
                            _.each(dataList, (ele) => {
                                taskObj.thumb = wwwPrefix + ele.message.thumb
                            })
                        }
                    })
                })

                return

                // Test[2]: 测试很多的情况下的列表展示
                for (let i =0; i < 50; ++i){
                    let taskObj = new Task("images/picture.svg", "Images" + i, "/url/image" + i, i + '.2MB')
                    that.taskList.push(taskObj)
                    that.taskID2taskObj[taskObj.id] = taskObj
                }  
            }, function(data){ // Normal code
                if(data.success) {
                    var imageFiles = data.filesArray
                    imageFiles.forEach((fileObj, dinx) => {
                        let taskObj = new Task("images/picture.svg", fileObj.fileName, fileObj.filePath, fileObj.fileSizeStr)
                        that.taskList.push(taskObj)
                        that.taskID2taskObj[taskObj.id] = taskObj
                    })
                }
            })
        },

        onBtnImportDirClick(){
            var that = this

            console.log("-------------------- call import dir")
            // call bs 
            BS.b$.selectDir({
                title: this.$t('pages.repair.dialog-import-dir-images.title'),
                prompt: this.$t('pages.repair.dialog-import-dir-images.prompt'),
                allowMulSelection: true
            }, function(){
                for(let i =0; i < 5; ++i){
                    var taskObj = new Task("images/folder.svg", "ImagesDir" + i, "/url/imageDir" + i, i + '22.2MB')
                    that.taskList.push(taskObj)
                    that.taskID2taskObj[taskObj.id] = taskObj
                }  
            }, function(data){
                if(data.success) {
                    var imageFiles = data.filesArray
                    imageFiles.forEach((fileObj, dinx) => {
                        let taskObj = new Task("images/picture.svg", fileObj.fileName, fileObj.filePath, fileObj.fileSizeStr)
                        that.taskList.push(taskObj)
                        that.taskID2taskObj[taskObj.id] = taskObj
                    })
                }
            })
        },

        onBtnRemoveAllClick(){
            var that = this

            if(that.taskList.length > 0) {
                const cdg = that.confirmDialog
                cdg.title = that.$t('pages.repair.dialog-confirm-remove-all.title')
                cdg.content = that.$t('pages.repair.dialog-confirm-remove-all.message')
                cdg.confirmButtonText = that.$t('pages.repair.dialog-confirm-remove-all.btnConfirm')
                cdg.denyButtonText = that.$t('pages.repair.dialog-confirm-remove-all.btnDeny')

                var dialog = that.$refs[cdg.ref]
                cdg.callbackConfirm = () =>{
                    that.stopFix()
                    that.taskList.splice(0, that.taskList.length)
                }
                dialog.open()
            }
        },

        onBtnFixClick(){
            var that = this
            
            if(that.taskList.length === 0) {
                return BS.b$.Notice.alert({
                    message: that.$t('pages.repair.notice-no-items.message')
                })
            }

            console.log("---------------------- call export dir")
            BS.b$.selectOutDir({
                title: that.$t('pages.repair.dialog-select-outdir.title'),
                prompt: that.$t('pages.repair.dialog-select-outdir.prompt'),
                canCreateDir: true
            },()=>{
                that.startFix('D:\\TestResource\\exif_sample_images\\Nikon\\corrupted_output')
            },(data)=>{
                if(data.success) {
                    var outDir = data.filePath
                    that.startFix(outDir)
                }
            })
        },

        onBtnStopFixClick(){
            var that = this

            if(that.isFixworking) {
                const cdg = that.confirmDialog
                cdg.title = that.$t('pages.repair.dialog-confirm-stop-fix.title')
                cdg.content = that.$t('pages.repair.dialog-confirm-stop-fix.message')
                cdg.confirmButtonText = that.$t('pages.repair.dialog-confirm-stop-fix.btnConfirm')
                cdg.denyButtonText = that.$t('pages.repair.dialog-confirm-stop-fix.btnDeny')

                var dialog = that.$refs[cdg.ref]
                cdg.callbackConfirm = () =>{
                    that.stopFix()
                }
                dialog.open()
            }            
        },

        startFix(outDir){
            var that = this

            var srcImagesMap = {}
            _.each(that.taskList, (taskObj, index) => {
                srcImagesMap[taskObj.id] = taskObj.path
            })

            that.curFixTaskID = _.uniqueId(taskPrefix + 'task-')
            Transfer.Tools.call('start.fix.image', {
                taskID: that.curFixTaskID,
                data:{
                    src: srcImagesMap,
                    outputDir: outDir || BS.b$.App.getTempDir()
                },
                lang: Vue.config.lang
            }, (data) =>{
                if (data.msg_type === 's_task_exec_running') {
                    that.isFixworking = true
                }else if (data.msg_type === 's_task_exec_feedback') {
                    let dataList = data.content
                    that.isFixworking = (dataList.length > 0)
                    _.each(dataList, (ele) => {
                        let curImageTaskObj = that.taskID2taskObj[ele.id]
                        if (curImageTaskObj) {
                            curImageTaskObj.isworking = ele.progress >= 100 ? false : true
                            curImageTaskObj.progress = ele.progress >= 100 ? 100: ele.progress
                            curImageTaskObj.stateInfo.state = ele.state
                            curImageTaskObj.stateInfo.message = ele.message || ''
                        }
                    })
                }else if (data.msg_type === 's_task_exec_result') {

                }
            })
        },

        stopFix(notice = true){
            var that = this
            // send stop message to server
            var srcImagesMap = {}
            _.each(that.taskList, (taskObj, index) => {
                // change all item state
                taskObj.isworking = false
                // prepare
                srcImagesMap[taskObj.id] = taskObj.path
            })

            if(!notice) return
            if(_.keys(srcImagesMap).length > 0 && that.isFixworking) {
                Transfer.Tools.call('stop.fix.image',{
                    taskID: that.curFixTaskID,
                    data:{
                        src: srcImagesMap
                    }
                })
            }
        },

        // -----------------------------------------
        // for task item
        __removeTaskItem(item, index) {
            var that = this
            item.isworking = false;
            // TODO：remove it from taskList
            item.progress = 0
            item.stateInfo = 0
            that.taskID2taskObj[item.id] = null

            // remove from taskList
            that.taskList.splice(index, 1)
        },
        onRemoveTaskItem(item, index) {
            console.log('item: ', item, 'index: ', index)
            var that = this
            
            if(item.isworking) {
                // notice to server 
                let srcImagesMap = {}
                srcImagesMap[item.id] = item.path
                Transfer.Tools.call('stop.fix.image',{
                    taskID: that.curFixTaskID,
                    data:{
                        src: srcImagesMap
                    }
                })
                that.__removeTaskItem(item, index)
            }else {
                that.__removeTaskItem(item, index)
            }

        },
        onOpenParentDir(dir){
            var that = this
            BS.b$.revealInFinder(dir)
        },
        onPreviewFile(file){
            BS.b$.previewFile(dir)
        }
        // -------------------------------------------
    },

    components: {
        UiIcon,
        UiTabs,
        UiTab,
        UiButton,
        UiIconButton,
        UiAlert,
        UiToolbar,
        UiConfirm,
        UiProgressLinear
    }
}

</script>
