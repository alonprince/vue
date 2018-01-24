/* @flow */

/**
 * Done
 */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

/**
 * 初始化事件
 * 绑定上父级已有的事件
 * @param {*} vm vue实例
 */
export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // 把父级的事件给自己绑定，猜测是为了事件冒泡 ------ ✘
  // 父级的事件交由子集触发，比如<a @click="handleClick"><b /></a>
  // 其实是将handleClick绑定在了b组件的events上
  // 当执行的emit的时候，就是触发监听事件的
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}
/* TODO: 为什么要引入target，而不是传进去
  猜测是为了api保持一致
*/
let target: any

function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

function remove (event, fn) {
  target.$off(event, fn)
}

/**
 * 更新绑定的事件
 * @param {*} vm vue实例
 * @param {Object} listeners 绑定的事件Map
 * @param {Object} oldListeners 旧的事件Map
 */
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
  target = undefined
}

/**
 * 事件的混入
 * 主要是加入了$once, $on, $off, $emit
 * @param {*} Vue 构造函数
 */
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  /**
   * 相当于addEventListener
   * @param {*} event 需要监听的事件
   * @param {*} fn 事件触发时的方法
   */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // 往相关事件里面添加需要执行的方法
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /**
   * 绑定单次触发的事件
   * @param {*} event 
   * @param {*} fn 
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 将需要执行的fn包装成一个新函数，函数里面含有解绑函数
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * 解绑事件
   * @param {*} event 
   * @param {*} fn 
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 如果没有参数，就是清除所有事件的监听
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    // 如果事件本来就没有被监听
    // 直接返回
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 不传入fn，说明解绑当前event上的所有函数
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      // 这个地方不用indexOf的原因是因为
      // indexOf会返回找到的第一个
      // 而同一个事件，触发多次方法的情况存在，所以需要用while
      // 这个地方逆着减是为了防止splice删除元素之后，导致使用i值取值会跳过一个元素
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

  /**
   * 触发事件
   * 本以为是使用自定义事件或者是pub/sub的方式来实现的
   * 其实是通过把父级绑定的事件直接交由子集执行来实现
   * @param {*} event 
   */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 提醒用户emit的时候只能使用小写，为了和html的标准保持一致
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      // 如果父级监听了这个事件就执行
      // 如果子集只emit了，父级并未监听，就不触发
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
