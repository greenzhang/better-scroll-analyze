## Better-Scroll源码分析及学习(一)
>better-scroll是一款用于解决**移动端**滚动需求的插件,它非常小巧，源码为56KB，压缩并开启gzip之后，仅有8KB。

在讲解源码之前，先要说一下目前移动端滚动条方面的背景，痛点和相关的实现方案。
按照实际的业务需求，滚动条一般分为全局滚动和局部滚动，在早期的移动端，浏览器是不支持非body元素的滚动条的，当我们需要在局部的一个固定高度的容器内进行滚动内容是做不到的，这也是iScroll等类似的滚动条插件出现的原因。
在安卓4.3 ios8以前，要监听scroll事件是比较麻烦的事情，因为在使用原生滚动的时候，只有在滚动完了，才会有监听的数据返回,在滚动过程中js是被禁止的。
更严重的问题是，滚动条的性能在低端安卓机器上非常差，在我实验的使用安卓4.4系统里，多数情况下是无法达到30fps，肉眼可见的卡顿直接说明了用户体验的糟糕(ios系统需要使用css属性webkit-overflow-scrolling来让滚动更平滑)。
![Low pack android](./demo/img/low_pack_android_performance.png)

从图中可以看出滚动和页面渲染之间密切的关系，在每次触发scroll行为的时候，都会使得页面不断的重新渲染，而低端安卓机的性能并不可靠，所以滚动起来也就出现卡顿。

常见的scroll插件，基本都是从两个方面着手来实现的.

    1.监听元素的touchMove事件,通过修改transform来实现滚动动画,这其中又有两种方式可以达到这个目的.s
        a.一个是在touchMove的时候,计算滚动的速度,力度,模拟惯性滚动的长度和事件,然后再监听transitionend来模拟scrollend事件.
        b.使用requestAnimationFrame请求浏览器在每次刷新时执行派发"scroll"事件.
    2.使用原生(overflow:auto)来实现滚动,在安卓手机上不会有回弹效果,在ios上可能会和默认的手势冲突.

better-scroll就是采用第一种方式来实现的,所以功能也非常丰富，具有有回弹效果，纯文字列表滑动也比较自然,但是它也有自己的缺陷,在滚动数据较多的时候,会比较卡顿,所以在有大量DOM结构的业务需求当中,尽量不要使用better-scroll.使用原生的滚动条并对其进行一定程度的扩展会会是一个比较好的方案.

由于源码较长,源码分析的详细部分我会在代码注释部分写,文章目前是按照scroll的核心功能模块来进行选择性的讲解
目录结构
```
| |—— util 工具库
| |    |____ dom : 对DOM操作的库，例如获取兼容浏览器的css前缀，获取元素相对位置，节点插入等
| |    |____ ease : 贝塞尔曲线
| |    |____ env : 运行环境
| |    |____ index : 导出当前util的所有库
| |    |____ lang : 拷贝函数及高精度时间
| |    |____ momentum : 滚动动量/回弹动画的库
| |    |____ debug : 控制台告警
| |    |____ raf : requestAnimateFrame函数
| |    |____ const : 定义的常量
| |
| |—— scroll : 核心功能
| |    |____ core : 处理滚动三大事件和处理滚动动画相关的函数。
| |    |____ event : 事件监听
| |    |____ init : 初始化：参数配置、DOM 绑定事件、调用其他扩展插件
| |    |____ pulldown : 下拉刷新功能
| |    |____ pullup : 上拉加载更多功能
| |    |____ scrollbar : 生成滚动条、滚动时实时计算大小与位置
| |    |____ snap : 扩展的轮播图及一系列操作
| |    |____ wheel : 扩展的picker插件操作
```
作者将better-scroll的原型链通过mixin的方式分成不同的功能部分并进行扩展
```javascript
import { initMixin } from './scroll/event'
.
.
.
```
最后再统一合并并export出来
```js

initMixin(BScroll)
.
.
.

export default BScroll

```
better-scroll是提供用户自定义配置的,
自定义配置部分，可以直接参考better-scroll的api文档，源码在处理自定义配置也是完全根据用户的设置和api文档来的。

在init模块中,作者做了如下一些事情.

    1.将用户传入的配置参数与默认参数一起进行合并配置
    2.将初始化的自定义事件缓存,并定义了滚动过程中滚动元素的位置和方向(扩展x,y,directionX和directionY用于存放滚动过程中x轴y轴上的位置和方向)
    3.**对原生的事件进行监听(mouse,touch,resize,orientationchange)**
    4.根据配置需求,初始化其他功能(如snap/wheel之类)
    5.**初始化observer**
    6.**refresh方法,当滚动组件内部dom变化的时候,重新计算滚动容器的高宽,滚动条的位置,并将滚动元素重置**
    6.初始化滚动元素的位置

重点讲解的部分就是3/5/6三块


源码中第一个比较精髓的地方就是原生事件的监听和销毁部分.
better-scroll是一个滚动插件，所以必定要监听原生的事件。通常而言，我们写一个事件的监听函数，一般会像如下的方式编写
```js
target.addEventListener('type', fn, false/true)
```
这其中第二个参数fn我们都是写成函数的形式去处理，但这样有一个问题，在你要注销这个监听事件的时候，你必须要传递一个一模一样的函数进去才可以。在我们需要监听大量的事件的时候，这种做法就不可行了。在[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener)的文档中，其实还有另一种写法，即传入一个具有handleEvent属性的对象就行，这样在我们需要移除事件监听的时候，只要将方法中的addEventListener修改为removeEventListener就行，非常优雅。
此处的代码实现可以直接参考[addEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/util/dom.js#L39)和[removeEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/util/dom.js#L43)方法。
better-scroll这里，是将this[直接传入](https://github.com/ustbhuangyi/better-scroll/blob/master/src/scroll/init.js#L172)，因为better-scroll已经在原型中定义了[handleEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/scroll/init.js#L333)方法。

初始化模块中另一个的属性`isInTransition`，是用来处理处于过度动画的时候，禁用鼠标事件(为了解决 #359 issue)。这里是使用了es5的Object.defineprototy来实现的对对象进行双向绑定功能(与vue的基本实现方式一致,所以在ie8以下无法使用).
```js
  BScroll.prototype._watchTransition = function () {
    if (typeof Object.defineProperty !== 'function') {
      return
    }
    let me = this
    let isInTransition = false
    Object.defineProperty(this, 'isInTransition', {
      get() {
        return isInTransition
      },
      set(newVal) {
        isInTransition = newVal
        // fix issue #359
        let el = me.scroller.children.length ? me.scroller.children : [me.scroller]
        let pointerEvents = (isInTransition && !me.pulling) ? 'none' : 'auto'
        for (let i = 0; i < el.length; i++) {
          el[i].style.pointerEvents = pointerEvents
        }
      }
    })
  }
```

在_initDOMObserver()方法中,作者判断了浏览器是否兼容MutationObserver,使用MutationObserver来观测对象当前滚动区对应的scroller对象（在入口文件中就已经挂载到了bscroll对象上），如果浏览器不支持MutationObserver，则采用慢轮询来兼容以达到同样的检测效果。如果scroller一有改变，则调用refresh()方法重新计算滚动区高度.


初始化中最后一个重要的方法就是refresh()方法，他是用来在DOM结构发生变化的时候保证滚动效果正常的方法,主要是获取容器和滚动元素的宽高，计算最大滚动距离。

```js
  BScroll.prototype.refresh = function () {
    // 通过getBoundingClientRect来获取容器的宽高
    let wrapperRect = getRect(this.wrapper)
    this.wrapperWidth = wrapperRect.width
    this.wrapperHeight = wrapperRect.height

    // 通过getBoundingClientRect来获取滚动元素的宽高

    let scrollerRect = getRect(this.scroller)
    this.scrollerWidth = scrollerRect.width
    this.scrollerHeight = scrollerRect.height

    const wheel = this.options.wheel
    if (wheel) {
      this.items = this.scroller.children
      this.options.itemHeight = this.itemHeight = this.items.length ? this.scrollerHeight / this.items.length : 0
      if (this.selectedIndex === undefined) {
        this.selectedIndex = wheel.selectedIndex || 0
      }
      this.options.startY = -this.selectedIndex * this.itemHeight
      this.maxScrollX = 0
      this.maxScrollY = -this.itemHeight * (this.items.length - 1)
    } else {
       //计算最大的横向滚动距离
      this.maxScrollX = this.wrapperWidth - this.scrollerWidth
       //计算最大的纵向滚动距离
      this.maxScrollY = this.wrapperHeight - this.scrollerHeight
    }

    this.hasHorizontalScroll = this.options.scrollX && this.maxScrollX < 0
    this.hasVerticalScroll = this.options.scrollY && this.maxScrollY < 0

    if (!this.hasHorizontalScroll) {
      this.maxScrollX = 0
      this.scrollerWidth = this.wrapperWidth
    }

    if (!this.hasVerticalScroll) {
      this.maxScrollY = 0
      this.scrollerHeight = this.wrapperHeight
    }
    //滚动结束时间
    this.endTime = 0
    //横向滚动方向， 0表示没有滚动
    this.directionX = 0
    //纵向滚动方向， 0表示没有滚动
    this.directionY = 0
    this.wrapperOffset = offset(this.wrapper)
    //触发"refresh"事件
    this.trigger('refresh')
    //  重置滚动元素位置
    this.resetPosition()
  }
```
在web页面中,坐标系参考是在元素的左上方的,所以如果我们向上/向左滚动的话,那maxScrollX/maxScrollY必定是负值,所以只要判断他们的值的正负,就能说明元素是否可以滚动.

在DOM结构改变后，scroller需要获取容器和滚动元素的宽高，重新计算最大的滚动距离等。
以上就是初始化模块当中涉及到的重点的部分，在下一章当中，将分析滚动的原理和核心部分。
