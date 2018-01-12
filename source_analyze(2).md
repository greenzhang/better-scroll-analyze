## Better-Scroll源码分析及学习(二)

本文是讲解better-scroll具体是如何模拟滚动条的动作来进行滚动的。
在我们手指在屏幕上滑动的时候，better-scroll做了哪些事情呢，接下来就一点点的分析

首先在上一章当中，better-scroll初始化的时候，监听了一些原生的事件，比如touch，然后在handleEvent中，针对滑动的不同事件触发，也有不同的回调函数
```js

  BScroll.prototype.handleEvent = function (e) {
    switch (e.type) {
      case 'touchstart':
      case 'mousedown':
        this._start(e)
        break
      case 'touchmove':
      case 'mousemove':
        this._move(e)
        break
      case 'touchend':
      case 'mouseup':
      case 'touchcancel':
      case 'mousecancel':
        this._end(e)
        break
      case 'orientationchange':
      case 'resize':
        this._resize()
        break
      case 'transitionend':
      case 'webkitTransitionEnd':
      case 'oTransitionEnd':
      case 'MSTransitionEnd':
        this._transitionEnd(e)
        break
      case 'click':
        if (this.enabled && !e._constructed) {
          if (!preventDefaultException(e.target, this.options.preventDefaultException)) {
            e.preventDefault()
            e.stopPropagation()
          }
        }
        break
    }
  }
```
滑动的过程对应了_start()/_move()/_end这三个函数。从第一个开始分析
