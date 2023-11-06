from kivy.app import App
from kivy.lang.builder import Builder
from kivy.uix.boxlayout import BoxLayout
from kivy.clock import Clock
from kivy.properties import ObjectProperty
from kivy.network.urlrequest import UrlRequest

from functools import partial

import webbrowser
import plyer

def cekjr(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            socket.setdefaulttimeout(3)
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(('8.8.8.8', 53))
            return func(*args, **kwargs)
        except socket.error as ex:
            plyer.notification.notify(toast=True, message='koneksi internet bermasalah')
    return wrapper


class Layar(BoxLayout):
    nim = ObjectProperty()
    info = ObjectProperty()
    btncek = ObjectProperty()

    url_web = 'https://bot-siakad.cyclic.cloud'

    def set_text(self, text, *args):
        self.info.text += text
        Clock.tick_draw()

    def info_scroll(self, text):
        for i in text:
            waktu = 0.2
            if i == '\n':
                waktu = 1
            Clock.schedule_once(partial(self.set_text, i), waktu)
    @cekjr
    def cek_aktv_res(self, th, data):
        log = data['log']
        akun = data['akun']
        if akun and log:
            nama = akun['nama']
            self.info_scroll(f'akun ditemukan, halo {nama} ')
            self.info_scroll(f'berikut adalah aktivitas akun anda ...\n\n')
            for mk in log:
                waktu = mk.get("waktu", None)
                self.info_scroll(f'---- {waktu} ----\n   ')
                self.info_scroll(f' {mk["mk"]}, {mk["msg"]}\n')
        else:
            self.info_scroll(f'akun tidak ditemukan silahkan loging di di [u][ref=open_web]{self.url_web}[/ref][/u]...\n')
        self.btncek.disabled = False

    @cekjr
    def cek_aktivitas(self):
        nim = self.nim.text
        self.btncek.disabled = True
        UrlRequest((f'{self.url_web}/get-log-by-nim/{nim}'), self.cek_aktv_res)

    def open_web(self):
        webbrowser.open(self.url_web)


Builder.load_string("""
#:set hijau (0,1,0,1)

<LabelHeker@Label>:
    color: hijau
    text_size: self.width, None
    height: self.texture_size[1]

<ButtonHeker@Button>:
    background_color: (1,0,1,1)

<Layar>:
    nim: nim
    info: info
    btncek:btncek
    padding: 40
    spacing: 20
    orientation: 'vertical'
    Image:
        source: 'assets/img/logobs.png'
        size_hint_y: 3
    Label:
        text: 'Silahkan Masukkan [b]NIM[/b] anda'
        markup: True
    BoxLayout:
        spacing: 10
        size_hint_y: 0.5
        TextInput:
            id: nim
            font_size: 60
            hint_text: 'D012...'
            multiline: False
            size_hint_x: 0.7
        ButtonHeker:
            id: btncek
            size_hint_x: 0.3
            text: 'Cek Aktivitas'
            on_release:
                root.cek_aktivitas()
    ScrollView:
        size_hint_y: 8
        canvas.before:
            Color:
                rgba: (1,0,1,0.06)
            Rectangle:
                pos: self.pos
                size: self.size
        LabelHeker:
            id: info
            padding: 20, 20
            size_hint_y: None
            font_size: 45
            markup: True
            on_ref_press:
                root.open_web()
""")


class MyApp(App):
    def on_pause(self):
        return True
    def on_start(self):
        plyer.orientation.set_sensor(mode='portrait')
    def build(self):
        return Layar()


if __name__ == "__main__":
    app = MyApp()
    app.run()