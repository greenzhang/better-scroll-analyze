import {
  eventType,
  TOUCH_EVENT,
  preventDefaultException,
  tap,
  click,
  style,
  offset
} from '../util/dom'
import { ease } from '../util/ease'
import { momentum } from '../util/momentum'
import { requestAnimationFrame, cancelAnimationFrame } from '../util/raf'
import { getNow } from '../util/lang'
import { DIRECTION_DOWN, DIRECTION_UP, DIRECTION_LEFT, DIRECTION_RIGHT } from '../util/const'
import { isAndroid } from '../util/env'

export function coreMixin(BScroll) {
  BScroll.prototype._start = function (e) {
    // 获得事件
    let _eventType = eventType[e.type]
    // 判断是否是鼠标事件
    if (_eventType !== TOUCH_EVENT) {
          // 如果鼠标事件，并且不是左键触发的 return
      if (e.button !== 0) {
        return
      }
    }
    // 未开启/已销毁 return
    if (!this.enabled || this.destroyed || (this.initiated && this.initiated !== _eventType)) {
      return
    }
    this.initiated = _eventType

    // 阻止浏览器默认行为
    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }
    // 初始化


    this.moved = false
    // 滑动距离x/y轴
    this.distX = 0
    this.distY = 0
    // 滑动方向（左右） -1 表示从左向右滑，1 表示从右向左滑，0 表示没有滑动。
    this.directionX = 0
    // 滑动方向（上下） -1 表示从上往下滑，1 表示从下往上滑，0 表示没有滑动。
    this.directionY = 0
    // 滑动过程中的方向(左右) -1 表示从左向右滑，1 表示从右向左滑，0 表示没有滑动
    this.movingDirectionX = 0
    // 滑动过程中的方向(上下) -1 表示从上向下滑，1 表示从下向上滑，0 表示没有滑动
    this.movingDirectionY = 0
    this.directionLocked = 0
    // 初始化过渡时间
    this._transitionTime()
    // 初始化开始时间
    this.startTime = getNow()

    if (this.options.wheel) {
      this.target = e.target
    }

    this.stop()

    //
    let point = e.touches ? e.touches[0] : e

    // 滚动开始x/y轴
    this.startX = this.x
    this.startY = this.y
    this.absStartX = this.x
    this.absStartY = this.y
    // 触发点相当于页面的位置
    this.pointX = point.pageX
    this.pointY = point.pageY

    this.trigger('beforeScrollStart')
  }

  BScroll.prototype._move = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }

    if (this.options.preventDefault) {
      e.preventDefault()
    }
    // 获取手指当前的坐标
    let point = e.touches ? e.touches[0] : e
    // 与上次缓存的坐标做移动距离计算
    let deltaX = point.pageX - this.pointX
    let deltaY = point.pageY - this.pointY

    // 缓存坐标
    this.pointX = point.pageX
    this.pointY = point.pageY

    this.distX += deltaX
    this.distY += deltaY

    // 取绝对值
    let absDistX = Math.abs(this.distX)
    let absDistY = Math.abs(this.distY)

    let timestamp = getNow()
    // 只有在限定时间内滑动过一定距离才会被认为是一次有效的滑动
    // We need to move at least momentumLimitDistance pixels for the scrolling to initiate
    if (timestamp - this.endTime > this.options.momentumLimitTime && (absDistY < this.options.momentumLimitDistance && absDistX < this.options.momentumLimitDistance)) {
      return
    }
    // 在没有开启自由滚动的情况下，根据滑动的方向，锁定该方向
    // If you are scrolling in one direction lock the other
    if (!this.directionLocked && !this.options.freeScroll) {
      if (absDistX > absDistY + this.options.directionLockThreshold) {
        this.directionLocked = 'h'		// lock horizontally 锁定水平
      } else if (absDistY >= absDistX + this.options.directionLockThreshold) {
        this.directionLocked = 'v'		// lock vertically 锁定垂直
      } else {
        this.directionLocked = 'n'		// no lock
      }
    }

    if (this.directionLocked === 'h') {
      if (this.options.eventPassthrough === 'vertical') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'horizontal') {
        this.initiated = false
        return
      }
      deltaY = 0
    } else if (this.directionLocked === 'v') {
      if (this.options.eventPassthrough === 'horizontal') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'vertical') {
        this.initiated = false
        return
      }
      deltaX = 0
    }

    deltaX = this.hasHorizontalScroll ? deltaX : 0
    deltaY = this.hasVerticalScroll ? deltaY : 0
    this.movingDirectionX = deltaX > 0 ? DIRECTION_RIGHT : deltaX < 0 ? DIRECTION_LEFT : 0
    this.movingDirectionY = deltaY > 0 ? DIRECTION_DOWN : deltaY < 0 ? DIRECTION_UP : 0


    let newX = this.x + deltaX
    let newY = this.y + deltaY

    // Slow down or stop if outside of the boundaries
    if (newX > 0 || newX < this.maxScrollX) {
      if (this.options.bounce) { // 如果设置边缘回弹
        newX = this.x + deltaX / 3 // 降速
      } else {
        newX = newX > 0 ? 0 : this.maxScrollX // 否则直接为0
      }
    }
    if (newY > 0 || newY < this.maxScrollY) {
      if (this.options.bounce) {
        newY = this.y + deltaY / 3
      } else {
        newY = newY > 0 ? 0 : this.maxScrollY
      }
    }

    if (!this.moved) {
      this.moved = true
      this.trigger('scrollStart')
    }
    // 滚动到指定位置
    this._translate(newX, newY)

    // 派发滚动事件
    if (timestamp - this.startTime > this.options.momentumLimitTime) {
      this.startTime = timestamp
      this.startX = this.x
      this.startY = this.y

      if (this.options.probeType === 1) {
        this.trigger('scroll', {
          x: this.x,
          y: this.y
        })
      }
    }

    if (this.options.probeType > 1) {
      this.trigger('scroll', {
        x: this.x,
        y: this.y
      })
    }

    // 滑动到边缘的时候，执行滑动结束
    let scrollLeft = document.documentElement.scrollLeft || window.pageXOffset || document.body.scrollLeft
    let scrollTop = document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop

    let pX = this.pointX - scrollLeft
    let pY = this.pointY - scrollTop

    if (pX > document.documentElement.clientWidth - this.options.momentumLimitDistance || pX < this.options.momentumLimitDistance || pY < this.options.momentumLimitDistance || pY > document.documentElement.clientHeight - this.options.momentumLimitDistance
    ) {
      this._end(e)
    }
  }

  BScroll.prototype._end = function (e) {
    if (!this.enabled || this.destroyed || eventType[e.type] !== this.initiated) {
      return
    }
    this.initiated = false

    if (this.options.preventDefault && !preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    this.trigger('touchEnd', {
      x: this.x,
      y: this.y
    })
    // transition停止
    this.isInTransition = false

    // ensures that the last position is rounded
    let newX = Math.round(this.x)
    let newY = Math.round(this.y)

    let deltaX = newX - this.absStartX
    let deltaY = newY - this.absStartY
    this.directionX = deltaX > 0 ? DIRECTION_RIGHT : deltaX < 0 ? DIRECTION_LEFT : 0
    this.directionY = deltaY > 0 ? DIRECTION_DOWN : deltaY < 0 ? DIRECTION_UP : 0

    // if configure pull down refresh, check it first
    if (this.options.pullDownRefresh && this._checkPullDown()) {
      return
    }

    // check if it is a click operation
    if (this._checkClick(e)) {
      this.trigger('scrollCancel')
      return
    }
    // 越界后重置滚动位置，回弹效果
    // reset if we are outside of the boundaries
    if (this.resetPosition(this.options.bounceTime, ease.bounce)) {
      return
    }
    // 滚动到rounded之后的新位置？ 
    this.scrollTo(newX, newY)

    // 计算滑动距离和时间
    this.endTime = getNow()
    let duration = this.endTime - this.startTime
    let absDistX = Math.abs(newX - this.startX)
    let absDistY = Math.abs(newY - this.startY)

    // 判断轻拂操作
    // flick
    if (this._events.flick && duration < this.options.flickLimitTime && absDistX < this.options.flickLimitDistance && absDistY < this.options.flickLimitDistance) {
      this.trigger('flick')
      return
    }

    let time = 0
    // 判断是否要开始惯性滚动
    // start momentum animation if needed
    if (this.options.momentum && duration < this.options.momentumLimitTime && (absDistY > this.options.momentumLimitDistance || absDistX > this.options.momentumLimitDistance)) {
      let momentumX = this.hasHorizontalScroll ? momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options)
        : {destination: newX, duration: 0}
      let momentumY = this.hasVerticalScroll ? momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options)
        : {destination: newY, duration: 0}
      newX = momentumX.destination
      newY = momentumY.destination
      time = Math.max(momentumX.duration, momentumY.duration)
      this.isInTransition = true
    } else {
      if (this.options.wheel) {
        newY = Math.round(newY / this.itemHeight) * this.itemHeight
        time = this.options.wheel.adjustTime || 400
      }
    }

    let easing = ease.swipe
    if (this.options.snap) {
      let snap = this._nearestSnap(newX, newY)
      this.currentPage = snap
      time = this.options.snapSpeed || Math.max(
          Math.max(
            Math.min(Math.abs(newX - snap.x), 1000),
            Math.min(Math.abs(newY - snap.y), 1000)
          ), 300)
      newX = snap.x
      newY = snap.y

      this.directionX = 0
      this.directionY = 0
      easing = this.options.snap.easing || ease.bounce
    }

    if (newX !== this.x || newY !== this.y) {
      // change easing function when scroller goes out of the boundaries
      if (newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY) {
        easing = ease.swipeBounce
      }
      // 执行惯性滚动过渡动画
      this.scrollTo(newX, newY, time, easing)
      return
    }

    if (this.options.wheel) {
      this.selectedIndex = Math.round(Math.abs(this.y / this.itemHeight))
    }
    this.trigger('scrollEnd', {
      x: this.x,
      y: this.y
    })
  }

  BScroll.prototype._checkClick = function (e) {
    // when in the process of pulling down, it should not prevent click
    let preventClick = this.stopFromTransition && !this.pulling
    this.stopFromTransition = false

    // we scrolled less than 15 pixels
    if (!this.moved) {
      if (this.options.wheel) {
        if (this.target && this.target.className === this.options.wheel.wheelWrapperClass) {
          let index = Math.abs(Math.round(this.y / this.itemHeight))
          let _offset = Math.round((this.pointY + offset(this.target).top - this.itemHeight / 2) / this.itemHeight)
          this.target = this.items[index + _offset]
        }
        this.scrollToElement(this.target, this.options.wheel.adjustTime || 400, true, true, ease.swipe)
        return true
      } else {
        if (!preventClick) {
          if (this.options.tap) {
            tap(e, this.options.tap)
          }

          if (this.options.click && !preventDefaultException(e.target, this.options.preventDefaultException)) {
            click(e)
          }
          return true
        }
        return false
      }
    }
    return false
  }

  BScroll.prototype._resize = function () {
    if (!this.enabled) {
      return
    }
    // fix a scroll problem under Android condition
    if (isAndroid) {
      this.wrapper.scrollTop = 0
    }
    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = setTimeout(() => {
      this.refresh()
    }, this.options.resizePolling)
  }

  BScroll.prototype._startProbe = function () {
    cancelAnimationFrame(this.probeTimer)
    this.probeTimer = requestAnimationFrame(probe)

    let me = this

    function probe() {
      let pos = me.getComputedPosition()
      me.trigger('scroll', pos)
      if (!me.isInTransition) {
        me.trigger('scrollEnd', pos)
        return
      }
      me.probeTimer = requestAnimationFrame(probe)
    }
  }

  BScroll.prototype._transitionProperty = function (property = 'transform') {
    this.scrollerStyle[style.transitionProperty] = property
  }

  BScroll.prototype._transitionTime = function (time = 0) {
    this.scrollerStyle[style.transitionDuration] = time + 'ms'

    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionDuration] = time + 'ms'
      }
    }

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTime(time)
      }
    }
  }

  BScroll.prototype._transitionTimingFunction = function (easing) {
    this.scrollerStyle[style.transitionTimingFunction] = easing

    if (this.options.wheel) {
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].style[style.transitionTimingFunction] = easing
      }
    }

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].transitionTimingFunction(easing)
      }
    }
  }

  BScroll.prototype._transitionEnd = function (e) {
    if (e.target !== this.scroller || !this.isInTransition) {
      return
    }

    this._transitionTime()
    if (!this.pulling && !this.resetPosition(this.options.bounceTime, ease.bounce)) {
      this.isInTransition = false
      if (this.options.probeType !== 3) {
        this.trigger('scrollEnd', {
          x: this.x,
          y: this.y
        })
      }
    }
  }

  BScroll.prototype._translate = function (x, y) {
    if (this.options.useTransform) {
      this.scrollerStyle[style.transform] = `translate(${x}px,${y}px)${this.translateZ}`
    } else {
      x = Math.round(x)
      y = Math.round(y)
      this.scrollerStyle.left = `${x}px`
      this.scrollerStyle.top = `${y}px`
    }

    if (this.options.wheel) {
      const {rotate = 25} = this.options.wheel
      for (let i = 0; i < this.items.length; i++) {
        let deg = rotate * (y / this.itemHeight + i)
        this.items[i].style[style.transform] = `rotateX(${deg}deg)`
      }
    }

    this.x = x
    this.y = y

    if (this.indicators) {
      for (let i = 0; i < this.indicators.length; i++) {
        this.indicators[i].updatePosition()
      }
    }
  }

  BScroll.prototype._animate = function (destX, destY, duration, easingFn) {
    let me = this
    let startX = this.x
    let startY = this.y
    let startTime = getNow()
    let destTime = startTime + duration

    function step() {
      let now = getNow()

      if (now >= destTime) {
        me.isAnimating = false
        me._translate(destX, destY)

        if (!me.pulling && !me.resetPosition(me.options.bounceTime)) {
          me.trigger('scrollEnd', {
            x: me.x,
            y: me.y
          })
        }
        return
      }
      now = (now - startTime) / duration
      let easing = easingFn(now)
      let newX = (destX - startX) * easing + startX
      let newY = (destY - startY) * easing + startY

      me._translate(newX, newY)

      if (me.isAnimating) {
        me.animateTimer = requestAnimationFrame(step)
      }

      if (me.options.probeType === 3) {
        me.trigger('scroll', {
          x: me.x,
          y: me.y
        })
      }
    }

    this.isAnimating = true
    cancelAnimationFrame(this.animateTimer)
    step()
  }

  BScroll.prototype.scrollBy = function (x, y, time = 0, easing = ease.bounce) {
    x = this.x + x
    y = this.y + y

    this.scrollTo(x, y, time, easing)
  }

  BScroll.prototype.scrollTo = function (x, y, time = 0, easing = ease.bounce) {
    // 设置isInTransition
    this.isInTransition = this.options.useTransition && time > 0 && (x !== this.x || y !== this.y)

    // 如果设置中使用transiation并且过渡时间为0
    if (!time || this.options.useTransition) {
      // 设置transition属性
      this._transitionProperty()
      // transition过渡计算的方法
      this._transitionTimingFunction(easing.style)
      // 设置过渡时间
      this._transitionTime(time)
      // 设置transform：translate，这是better-scroll实现滑动的原理
      // 通过子元素不断改变transform:translate，来达到浏览器滚动的效果
      this._translate(x, y)

      // 如果probetype设置为3 则使用requestAnimateFrame在浏览器每次刷新时触发scroll事件，然后在回调中判断过渡状态是否结束
      if (time && this.options.probeType === 3) {
        this._startProbe()
      }

      if (this.options.wheel) {
        if (y > 0) {
          this.selectedIndex = 0
        } else if (y < this.maxScrollY) {
          this.selectedIndex = this.items.length - 1
        } else {
          this.selectedIndex = Math.round(Math.abs(y / this.itemHeight))
        }
      }
    } else {
      this._animate(x, y, time, easing.fn)
    }
  }

  BScroll.prototype.scrollToElement = function (el, time, offsetX, offsetY, easing) {
    if (!el) {
      return
    }
    el = el.nodeType ? el : this.scroller.querySelector(el)

    if (this.options.wheel && el.className !== this.options.wheel.wheelItemClass) {
      return
    }

    let pos = offset(el)
    pos.left -= this.wrapperOffset.left
    pos.top -= this.wrapperOffset.top

    // if offsetX/Y are true we center the element to the screen
    if (offsetX === true) {
      offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2)
    }
    if (offsetY === true) {
      offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2)
    }

    pos.left -= offsetX || 0
    pos.top -= offsetY || 0
    pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left
    pos.top = pos.top > 0 ? 0 : pos.top < this.maxScrollY ? this.maxScrollY : pos.top

    if (this.options.wheel) {
      pos.top = Math.round(pos.top / this.itemHeight) * this.itemHeight
    }

    this.scrollTo(pos.left, pos.top, time, easing)
  }
  // 
  BScroll.prototype.resetPosition = function (time = 0, easeing = ease.bounce) {
    let x = this.x
    let roundX = Math.round(x)
    if (!this.hasHorizontalScroll || roundX > 0) {
      x = 0
    } else if (roundX < this.maxScrollX) {
      x = this.maxScrollX
    }

    let y = this.y
    let roundY = Math.round(y)
    if (!this.hasVerticalScroll || roundY > 0) {
      y = 0
    } else if (roundY < this.maxScrollY) {
      y = this.maxScrollY
    }

    if (x === this.x && y === this.y) {
      return false
    }

    this.scrollTo(x, y, time, easeing)

    return true
  }

  BScroll.prototype.getComputedPosition = function () {
    let matrix = window.getComputedStyle(this.scroller, null)
    let x
    let y

    if (this.options.useTransform) {
      matrix = matrix[style.transform].split(')')[0].split(', ')
      x = +(matrix[12] || matrix[4])
      y = +(matrix[13] || matrix[5])
    } else {
      x = +matrix.left.replace(/[^-\d.]/g, '')
      y = +matrix.top.replace(/[^-\d.]/g, '')
    }

    return {
      x,
      y
    }
  }

  BScroll.prototype.stop = function () {
    // 如果开启了transition并且处于transition当中（惯性滚动中）
    if (this.options.useTransition && this.isInTransition) {
      // 设置transition状态为false
      this.isInTransition = false
      // 获取当前位置
      let pos = this.getComputedPosition()
      // 根据当前位置，设置页面滚动开始位置
      this._translate(pos.x, pos.y)
      if (this.options.wheel) {
        this.target = this.items[Math.round(-pos.y / this.itemHeight)]
      } else {
        // 触发滚动停止事件
        this.trigger('scrollEnd', {
          x: this.x,
          y: this.y
        })
      }
      this.stopFromTransition = true
    } else if (!this.options.useTransition && this.isAnimating) {
      this.isAnimating = false
      this.trigger('scrollEnd', {
        x: this.x,
        y: this.y
      })
      this.stopFromTransition = true
    }
  }

  BScroll.prototype.destroy = function () {
    this.destroyed = true
    this.trigger('destroy')

    this._removeDOMEvents()
    // remove custom events
    this._events = {}
  }
}
