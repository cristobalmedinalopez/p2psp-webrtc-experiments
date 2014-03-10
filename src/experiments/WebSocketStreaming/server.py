#!/usr/bin/python -O
# -*- coding: iso-8859-15 -*-

'''
GNU GENERAL PUBLIC LICENSE

This is an example of a streaming video server that sends a video 
stream (WebM) via websocket to the Web browser.

Copyright (C) 2014 Vicente González Ruiz,
                   Cristóbal Medina López,
                   Juan Alvaro Muñoz Naranjo.

http://www.p2psp.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
'''
import socket, threading, time, base64, hashlib, struct, binascii
from SimpleWebSocketServer import WebSocket, SimpleWebSocketServer


def receive_next_chunk(sock, size):
	data = sock.recv(size)
	
	prev_size = 0
	while len(data) < size:
	    prev_size = len(data)
	    data += sock.recv(size - len(data))
	
	return data

class SimpleEcho(WebSocket):

        def handleMessage(self):
            pass

        def handleConnected(self):
            print self.address, 'connected'
	  
	    '''
	    source_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	    GET_message = 'GET ' + "/consume/first" + ' HTTP/1.1\r\n'
	    GET_message += '\r\n'
	    source = ("127.0.0.1", 8080) #("150.214.150.68", 4551)
	    print source_socket.getsockname(), 'connecting to the source', source, '...'
	    source_socket.connect(source)
	    print source_socket.getsockname(), 'connected to', source
	    source_socket.sendall(GET_message)
 	    
	    chunk = receive_next_chunk(source_socket, 59)
	    print chunk
	    chunk = receive_next_chunk(source_socket, 1024)
            while True:
	    	self.sendMessage(buffer(chunk))
		chunk = receive_next_chunk(source_socket, 1024)
		time.sleep(0.01)

	    '''
	    file=open("test.webm","rb")
	    try:
	   	chunk = file.read(1024)
		while chunk:
			self.sendMessage(buffer(chunk))
			chunk = file.read(1024)
			#If you send too fast the client crashes
			time.sleep(0.01)
	    finally:
	   	file.close()
 	    
        def handleClose(self):
            print self.address, 'closed'         

if __name__ == '__main__':
    server = SimpleWebSocketServer('', 9876, SimpleEcho)
    server.serveforever()


