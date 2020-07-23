import axios from 'axios'
import store from '../store'
import ApiResponse from 'model/ApiResponse.class'
import ApiError from 'model/ApiError.class'
import { Message } from 'element-ui'
import { removeSession } from 'store/storage'
import { excludeErrCodeEnum } from 'config/enum/excludeErrCode'
import { toLoginPage } from '../permission'
import router from '../router'

// axios 配置
axios.defaults.timeout = 60000
axios.defaults.headers.post['Content-Type'] = 'application/json'
axios.defaults.baseURL = process.env.VUE_APP_API_HOST

// 对响应数据进行处理
axios.interceptors.response.use(function (response) {
  setTimeout(() => store.dispatch('setLoadingStatus', false), 300)
  const res = new ApiResponse(response)
  if (res.msg !== undefined) {
    // 目前接口返回200，则必定有 msg，所以暂不考虑返回200，success=false 情况
    return res.msg
  } else {
    // 因又拍云图片上传需要，不包含msg字段，故全部返回
    return res
  }
}, function (error) {
  setTimeout(() => store.dispatch('setLoadingStatus', false), 300)
  let message = error.message
  let code = 0
  if (error.response && error.response.data) {
    const resError = error.response.data
    message = resError.error_msg
    code = resError.error_code
  }
  const err = new ApiError(message, code)
  // 需要排除不统一处理的报错
  const excludeErrCode = [
    excludeErrCodeEnum.TOKEN_INVALID,
    excludeErrCodeEnum.REWORK_FAIL,
    excludeErrCodeEnum.PRODUCT_CHANGED,
    excludeErrCodeEnum.ORDER_REFUND,
    excludeErrCodeEnum.NEED_CHECK_PHOTO
  ]
  !excludeErrCode.includes(+err.code) && Message.warning(err.message)
  // 4011 未登录或登录状态失效
  switch (err.code) {
    case 4011:
      removeSession()
      toLoginPage()
      return false
    case 502:
      serverBusy()
      break
    case 500:
      if (err.message === 'Server Busy') {
        serverBusy()
      }
      break
    case 0:
      // 接口连接超时
      if (err.message.includes('timeout')) {
        serverBusy()
      }
      break
    default:
  }
  return Promise.reject(err)
})

// 设置请求头信息
axios.interceptors.request.use(
  config => {
    // 如果请求头里面带有 no-x-stream-id 则不传 x-stream-id
    const noXStreamId = config.headers.noXStreamId || false

    const streamId = store.getters.streamId
    if (streamId && streamId !== 'undefined' && !noXStreamId) {
      config.headers['x-stream-id'] = streamId
    }
    noXStreamId && delete config.headers.noXStreamId
    return config
  },
  error => {
    return Promise.reject(error)
  }
)
export default axios

async function serverBusy () {
  await store.dispatch('GetStoreLimitConfig')
  if (store.getters.isServerBusy) {
    await router.replace('/')
  }
}
