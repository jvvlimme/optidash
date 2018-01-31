import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
import 'element-ui/lib/theme-chalk/index.css'
import axios from 'axios'

// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import BootstrapVue from 'bootstrap-vue'
import VueYouTubeEmbed from 'vue-youtube-embed'
import Element from 'element-ui'
import locale from 'element-ui/lib/locale/lang/en'
import moment from 'vue-moment'
import VueHighcharts from 'vue-highcharts'
import Highcharts from 'highcharts'
import loadHighchartsMore from 'highcharts/highcharts-more'

loadHighchartsMore(Highcharts)

Vue.prototype.$base = 'http://localhost:3002'
Vue.prototype.$http = axios

Vue.use(VueYouTubeEmbed)
Vue.use(BootstrapVue)
Vue.use(Element, {locale})
Vue.use(moment)
Vue.use(VueHighcharts)

Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  template: '<App/>',
  components: { App }
})
