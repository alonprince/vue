/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'

// 解析事件类型，&eventName，~eventName，!eventName，eventName
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

// 执行一个或者多个函数
export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}


/**
 * 更新事件
 * 1.循环新监听事件列表
 * 2.如果监听的事件不存在，即定义了监听函数，但是函数不存在，抛出警告
 * 3.如果从未监听过事件，用invoke包装当前事件函数，将需要执行的函数存入fns，给vm绑定事件
 * 4.如果新老事件不相同，即监听的事件发生了改变，只需修改需要执行的fns函数列表即可
 * 5.查找老事件监听，已经不监听的事件，取消绑定
 * 
 * @param {*} on 新的监听事件列表，在init方法中，即为父级的事件，应该是为了冒泡
 * @param {*} oldOn 旧的监听事件列表
 * @param {*} add 绑定事件，vm.once或者vm.on
 * @param {*} remove 删除绑定事件, vm.off
 * @param {*} vm vue实例
 */
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, def, cur, old, event
  // 循环listeners里面的事件
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    // 如果事件不存在，抛出警告
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      // 如果老的不存在

      // 新的还未经过invoke包装
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur)
      }
      // 添加事件
      add(event.name, cur, event.once, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 如果新老不是同一个地址，即监听的事件发生了变化
      // 由于上面判断了old是否存在，所以此处old肯定是经过invoke包装之后的
      // 因为是经过invoke包装过后的，所以是进行过事件绑定了的，即调用过add方法
      // 此时只用修改invoke执行的fns队列即可
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    // 循环老的监听
    // 如果在新的监听事件中已经不存在
    // 就把老的监听事件给删除
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
