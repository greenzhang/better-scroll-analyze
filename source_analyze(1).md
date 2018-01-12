## Better-Scroll源码分析及学习(一)
>better-scroll是一款用于解决**移动端**滚动需求的插件,它非常小巧，源码为56KB，压缩并开启gzip之后，仅有8KB。

在讲解源码之前，先要说一下目前移动端滚动条方面的背景，痛点和相关的实现方案。
按照实际的业务需求，滚动条一般分为全局滚动和局部滚动，在早期的移动端，浏览器是不支持非body元素的滚动条的，当我们需要在局部的一个固定高度的容器内进行滚动内容是做不到的，这也是iScroll等类似的滚动条插件出现的原因。
在安卓4.4（不含/ios8以前，要监听scroll事件是比较麻烦的事情，因为在使用原生滚动的时候，只有在滚动完了，才会有监听的数据返回。
更严重的问题是，滚动条的性能在低端安卓机器上非常差，在我实验的使用安卓4.4系统里，多数情况下是无法达到30fps，肉眼可见的卡顿直接说明了用户体验的糟糕。
![Low pack android](./demo/img/low_pack_android_performance.png)

从图中可以看出滚动和页面渲染之间密切的关系，在每次触发scroll行为的时候，都会使得页面不断的重新渲染，而低端安卓机的性能并不可靠，所以滚动起来也就出现卡顿。

常见的scroll插件，基本都是从两个方面着手来实现的
1.监听元素的touchMove事件，通过修改css3的 transform来实现滚动动画，然后再手指离开的时候，触发touchEnd事件，随后的惯性滚动事件通过requestAnimateFrame来不断修改元素的transform来达到。
2.还是监听的scroll事件，
按照惯例，解读源码的时候我们先分析源码的结构部分。从入口开始，
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
下面就从初始化开始说起。
better-scroll是提供用户自定义配置的，所以在最开始会将你传入的参数和默认参数合并一下，同时扩展x,y,directionX和directionY用于存放滚动过程中x轴y轴上的位置和方向，然后对mouse,touch,resize,orientationchange（画面方向）事件进行了监听回调。最后调用refresh方法，重新计算容器和可滚动元素的宽高/可滚动最大距离，并重置滚动元素的位置。

自定义配置部分，可以直接参考better-scroll的api文档，源码在处理自定义配置也是完全根据用户的设置和api文档来的。

原生事件监听部分，是这个项目很有意思的一个地方。better-scroll是一个滚动插件，所以必定要监听原生的事件。通常而言，我们写一个事件的监听函数，一般会像如下的方式编写
```js
target.addEventListener('type', fn, false/true)
```
这其中第二个参数fn我们都是写成函数的形式去处理，但这样有一个问题，在你要注销这个监听事件的时候，你必须要传递一个一模一样的函数进去才可以。在我们需要监听大量的事件的时候，这种做法就不可行了。在[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener)的文档中，其实还有另一种写法，即传入一个具有handleEvent属性的对象就行，这样在我们需要移除事件监听的时候，只要将方法中的addEventListener修改为removeEventListener就行，非常优雅。
此处的代码实现可以直接参考[addEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/util/dom.js#L39)和[removeEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/util/dom.js#L43)方法。
better-scroll这里，是将this[直接传入](https://github.com/ustbhuangyi/better-scroll/blob/master/src/scroll/init.js#L172)，因为better-scroll已经在原型中定义了[handleEvent](https://github.com/ustbhuangyi/better-scroll/blob/master/src/scroll/init.js#L333)方法。

better-scroll中还有一个重要的属性`isInTransition`，是用来处理处于过度动画的时候，禁用鼠标事件。这里是使用了es5的Object.defineprototy来实现的对对象进行双向绑定

初始化中最后一个重要的方法就是refresh()方法，他是用来在DOM结构发生变化的时候保证滚动效果正常的方法。
在DOM结构改变后，scroller需要获取容器和滚动元素的宽高，重新计算最大的滚动距离等。
以上就是初始化当中涉及到的重点的部分，在下一章当中，将分析滚动的原理和核心部分。
