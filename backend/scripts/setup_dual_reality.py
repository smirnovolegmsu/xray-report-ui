#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для настройки конфигурации Xray для поддержки двух ссылок
с разными Reality параметрами (pbk/sid)
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.core.xray import load_xray_config, save_xray_config, derive_pbk_from_private
from backend.features.settings.services.backup_service import backup_file
from backend.core.config import load_settings

# Параметры ссылок
LINK1_UUID = "d02e5ca3-d735-4256-bf73-b536f2e8922c"
LINK1_EMAIL = "user_01"
LINK1_PBK_TARGET = "FwZaVY0p7GJ-PZRtneHIYNoJRxlpdQp9yRgHgUNlJW0"
LINK1_SID = "4edb2bdeeda9061f"

LINK2_UUID = "816cbfa6-204c-4c5d-8bed-9c8ef738736b"
LINK2_EMAIL = "user1@example.com"
LINK2_PBK = "otHrvrKVSDwHJ9b8rXV2GZreufgEQURtiWLkudZDYis"
LINK2_SID = "fc850e86d2b52f24"

def main():
    if len(sys.argv) > 1:
        # Если передан privateKey как аргумент
        link1_privkey = sys.argv[1]
        print(f"Используется переданный privateKey для ссылки 1")
    else:
        print("⚠️  Для полной настройки нужен privateKey для ссылки 1")
        print(f"   Целевой pbk: {LINK1_PBK_TARGET}")
        print()
        print("Использование:")
        print(f"  {sys.argv[0]} <private_key_for_link1>")
        print()
        print("Продолжаю настройку без правильного privateKey...")
        link1_privkey = None
    
    settings = load_settings()
    cfg, err = load_xray_config()
    if err:
        print(f"❌ Ошибка загрузки конфига: {err}")
        return 1
    
    config_path = settings['xray']['config_path']
    backup_path = backup_file(config_path, "dual_reality_final")
    print(f"✅ Бэкап создан: {backup_path}")
    
    # Обновляем первый inbound (порт 443) - добавляем оба UUID и оба shortId
    inbound1 = cfg['inbounds'][0]
    clients = inbound1['settings']['clients']
    client_uuids = {c.get('id', '').lower(): c for c in clients}
    
    # Добавляем UUID из ссылки 1, если его нет
    if LINK1_UUID.lower() not in client_uuids:
        clients.append({"id": LINK1_UUID, "email": LINK1_EMAIL, "flow": "xtls-rprx-vision"})
        print(f"✅ Добавлен UUID {LINK1_UUID} ({LINK1_EMAIL}) в первый inbound")
    
    # Убеждаемся, что UUID из ссылки 2 есть
    if LINK2_UUID.lower() not in client_uuids:
        clients.append({"id": LINK2_UUID, "email": LINK2_EMAIL, "flow": "xtls-rprx-vision"})
        print(f"✅ Добавлен UUID {LINK2_UUID} ({LINK2_EMAIL}) в первый inbound")
    
    inbound1['settings']['clients'] = clients
    
    # Добавляем оба shortId в первый inbound
    reality_settings = inbound1['streamSettings']['realitySettings']
    sids = reality_settings.get('shortIds', [])
    if LINK1_SID not in sids:
        sids.append(LINK1_SID)
    if LINK2_SID not in sids:
        sids.append(LINK2_SID)
    reality_settings['shortIds'] = sids
    print(f"✅ Обновлены shortIds в первом inbound: {sids}")
    
    # Проверяем/обновляем второй inbound (порт 8443)
    if len(cfg['inbounds']) > 1:
        inbound2 = cfg['inbounds'][1]
        if link1_privkey:
            # Обновляем privateKey во втором inbound
            inbound2['streamSettings']['realitySettings']['privateKey'] = link1_privkey
            pbk = derive_pbk_from_private(link1_privkey, settings)
            if pbk == LINK1_PBK_TARGET:
                print(f"✅ Обновлен privateKey во втором inbound - pbk совпадает!")
            else:
                print(f"⚠️  pbk не совпадает: получен {pbk}, нужен {LINK1_PBK_TARGET}")
        else:
            current_privkey = inbound2['streamSettings']['realitySettings']['privateKey']
            current_pbk = derive_pbk_from_private(current_privkey, settings)
            if current_pbk != LINK1_PBK_TARGET:
                print(f"⚠️  Второй inbound использует неправильный privateKey")
                print(f"   Текущий pbk: {current_pbk}")
                print(f"   Нужен pbk: {LINK1_PBK_TARGET}")
                print(f"   Обновите privateKey во втором inbound вручную")
    else:
        print("⚠️  Второй inbound не найден")
    
    # Сохраняем конфиг
    save_xray_config(cfg, config_path)
    print(f"✅ Конфиг сохранен")
    
    print()
    print("📋 Итоги настройки:")
    print("  ✅ Оба UUID добавлены в первый inbound")
    print("  ✅ Оба shortId добавлены в первый inbound")
    print("  ⚠️  Для ссылки 1 нужен правильный privateKey во втором inbound")
    print()
    print("Ссылка 2 должна работать на порту 443")
    print("Ссылка 1 будет работать на порту 8443 после настройки privateKey")
    print("  (или измените порт в ссылке 1 на 8443)")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
