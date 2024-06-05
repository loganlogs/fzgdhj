import sys
import requests
import os
import time
from fake_useragent import UserAgent

def save_project_name(project_name):
    with open('requete.txt', 'w', encoding='utf-8') as file:
        file.write(project_name)
    print(f"Le nom du projet '{project_name}' a été enregistré dans le fichier 'requete.txt'.")

def get_server_info(server_name):
    url = f'https://servers-frontend.fivem.net/api/servers/single/{server_name}'
    user_agent = UserAgent()
    headers = {
        'User-Agent': user_agent.random,
        'method': 'GET'
    }

    print(f"Récupération des informations pour le serveur '{server_name}'...")

    try:
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            print(f"Succès: Informations récupérées pour le serveur '{server_name}'.")
            server_data = response.json()
            project_name = server_data.get('Data', {}).get('vars', {}).get('sv_projectName')

            if project_name:
                save_project_name(project_name)
            else:
                print('Le projet de serveur n\'a pas de nom défini.\n')
        else:
            print(f"Erreur lors de la récupération des informations du serveur '{server_name}' ({response.status_code})")

    except Exception as e:
        print(f'Erreur: {str(e)}')

def main(server_name):
    get_server_info(server_name)

def startup():
    if len(sys.argv) != 2:
        print('Usage: python serverscrapadd.py <nom_du_serveur>')
        return

    server_name = sys.argv[1]
    os.system("cls")
    time.sleep(5)
    main(server_name)

startup()
