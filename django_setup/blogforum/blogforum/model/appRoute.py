from django.template import Context, loader
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.generic import TemplateView
import json

json_data = open('blogforum/model/userData.json')   
data1 = json.load(json_data) # deserialises it
data2 = json.dumps(data1) # json formatted string

json_data.close()



@csrf_exempt
@require_http_methods(['POST'])
def middle_ware(request):
    print(request)
    return JsonResponse({'message': 'Server response.'}, status=200)     



@csrf_exempt
@require_http_methods(['GET'])
def index(request):
    return render(request,template_name='index.html')


@csrf_exempt
@require_http_methods(['GET'])
def data(request):
    return JsonResponse({'data':data2}, status=200)     