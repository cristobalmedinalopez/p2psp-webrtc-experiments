#!/usr/bin/python -O
# -*- coding: iso-8859-15 -*-

# {{{ GNU GENERAL PUBLIC LICENSE

# This is the splitter node of the P2PSP (Peer-to-Peer Simple Protocol)
# <https://launchpad.net/p2psp>.
#
# Copyright (C) 2014 Vicente González Ruiz,
#                    Cristóbal Medina López,
#                    Juan Alvaro Muñoz Naranjo.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# }}}

# This code implements the DBS WebRTC splitter side of the P2PSP.
# {{{ Imports

import time
import sys
import socket
import threading
import struct
import argparse
import base64
import hashli
from color import Color
from splitter import Splitter_DBS

# }}}

class Splitter_WebRTC(Splitter_DBS):

     def __init__(self):
          Splitter_DBS.__init__(self)

     def handle_peer_arrival(self, (peer_serve_socket, peer)):
          # {{{
          

          sys.stdout.write(Color.green)
          print peer_serve_socket.getsockname(), '\b: accepted connection from peer', peer

          # **** WebSocket protocol handshake ****

	  # Recieve the WebSocket handshake request
	  # OJO: El mensaje podría ser incorrecto, controlar eso.
 	  handshake=peer_serve_socket.recv(4096)

	  # Calculate the WebSocket handshake response (http://tools.ietf.org/html/rfc6455#section-1.3)
	  lines = message.splitlines()
	  for line in lines:
	    parts = line.partition(": ")
	    if parts[0] == "Sec-WebSocket-Key":
		key = parts[2]

	  guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
	  accept_key = base64.b64encode(hashlib.sha1(key+guid).digest())
	  print "base64 accept key: "+accept_key

	  #Send WebSocket handshake response
	  aceeptMessage='HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept_key+'\r\n\r\n'
	  peer_serve_socket.send(aceeptMessage)


	  # **** 
	  
          # Send the header
          print "Sending", len(self.header), "bytes!!!!!!!!!"
          peer_serve_socket.sendall(self.header)

          # Send the buffer size.
          message = struct.pack("H", socket.htons(self.buffer_size))
          peer_serve_socket.sendall(message)

          # Send the chunk size.
          message = struct.pack("H", socket.htons(self.chunk_size))
          peer_serve_socket.sendall(message)

          print peer_serve_socket.getsockname(), '\b: sending the list of peers ...'

          # Sends the size of the list of peers.
          message = struct.pack("H", socket.htons(len(self.peer_list)))
          peer_serve_socket.sendall(message)

          # Send the list of peers.
          counter = 0
          for p in self.peer_list:
                message = struct.pack("4sH", socket.inet_aton(p[IP_ADDR]), socket.htons(p[PORT]))
                peer_serve_socket.sendall(message)
                print "[%5d]" % counter, p
                counter += 1

          print 'done'
          sys.stdout.write(Color.none)

          peer_serve_socket.close()

          if peer not in self.peer_list:
               self.peer_list.append(peer)                 
               self.deletions[peer] = 0
               self.losses[peer] = 0
               #self.complains[peer] = 0

          # }}}

     #SIN CAMBIOS
     def handle_arrivals(self):
          # {{{

          while self.alive:
               peer_serve_socket, peer = self.peer_connection_socket.accept()
               threading.Thread(target=self.handle_peer_arrival, args=((peer_serve_socket, peer), )).start()

          # }}}

     def moderate_the_team(self):
          # {{{

          while self.alive:
               # {{{

               message, sender = self.team_socket.recvfrom(struct.calcsize("H"))
               if len(message) == 2:

                    # {{{ The peer complains about a lost chunk

                    # The sender of the packet complains, and the
                    # packet comes with the index of a lost
                    # (non-received) chunk. In this situation, the
                    # splitter counts the number of times a peer has
                    # not achieved to send a chunk to other peers. If
                    # this number exceeds a threshold, the
                    # unsupportive peer is expelled from the
                    # team. Moreover, if we receive too much complains
                    # from the same peer, the problem could be in that
                    # peer and it will be expelled from the team.

                    lost_chunk = struct.unpack("!H",message)[0]
                    destination = self.destination_of_chunk[lost_chunk]
                    sys.stdout.write(Color.blue)
                    print sender, "complains about lost chunk", lost_chunk, "sent to", destination, Color.none
                    sys.stdout.write(Color.none)
                    try:
                         self.losses[destination]
                    except:
                         print "the unsupportive peer ", destination, "does not exist ???"
                         for p in self.peer_list:
                              print p,
                         print
                         pass
                    else:
                         self.losses[destination] += 1
                         print Color.blue, "\b", destination, "has loss", self.losses[destination], "chunks", Color.none
                         if destination != self.peer_list[0]:
                              if self.losses[destination] > self.losses_threshold:
                                   sys.stdout.write(Color.red)
                                   print "Too much complains about unsupportive peer", destination, "\b. Removing it!"
                                   self.peer_index -= 1
                                   try:
                                        self.peer_list.remove(destination)
                                        del self.losses[destination]
                                        del self.deletions[destination]
                                   except:
                                        pass
                                   sys.stdout.write(Color.none)
                    finally:
                         pass

                    # }}}

               else:
                    # {{{ The peer wants to leave the team

                    # A zero-length payload means that the peer wants to go away
                    sys.stdout.write(Color.red)
                    print self.team_socket.getsockname(), '\b: received "goodbye" from', sender
                    sys.stdout.write(Color.none)
                    sys.stdout.flush()
                    if sender != self.peer_list[0]:
                         try:
                              self.peer_index -= 1
                              self.peer_list.remove(sender)
                              if __debug__:
                                   print Color.red, "\b", sender, 'removed by "goodbye" message', Color.none
                         except:
                              # Received a googbye message from a peer
                              # which is not in the list of peers.
                              pass

                    # }}}

          # }}}

     def run(self):
          # {{{ Setup "peer_connection_socket"

          # peer_connection_socket is used to listen to the incomming peers.
          self.peer_connection_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
          try:
               # This does not work in Windows systems.
               self.peer_connection_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
          except:
               pass
          try:
               self.peer_connection_socket.bind((self.addr, self.port))
          except:
               print self.peer_connection_socket.getsockname(), "\b: unable to bind", (self.addr, self.port)
               print
               return
               
          self.peer_connection_socket.listen(socket.SOMAXCONN) # Set the connection queue to the max!

          # }}}
          # {{{ Setup "team_socket"

          # "team_socket" is used to talk to the peers of the team.
          self.team_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
          try:
               # This does not work in Windows systems !!
               self.team_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
          except:
               pass
          self.team_socket.bind((self.addr, self.port))

          # }}}

          source_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
          GET_message = 'GET ' + self.channel + ' HTTP/1.1\r\n'
          GET_message += '\r\n'
          def _():
               source = (self.source_addr, self.source_port)
               print source_socket.getsockname(), 'connecting to the source', source, '...'
               source_socket.connect(source)
               print source_socket.getsockname(), 'connected to', source

               source_socket.sendall(GET_message)
          _()

          source = (self.source_addr, self.source_port)

          def retrieve_header(GET, source, sock, size):
               data = sock.recv(size)
               while len(data) < size:
                    data += sock.recv(size - len(data))
               return data

          def receive_next_chunk(GET, source, sock, size):
               data = sock.recv(size)
               prev_size = 0
               while len(data) < size:
                    if len(data) == prev_size:
                         # This section of code is reached when
                         # the streaming server (Icecast)
                         # finishes a stream and starts with the
                         # following one.
                         print '\b!',
                         sys.stdout.flush()
                         time.sleep(1)
                         sock.close()
                         sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                         sock.connect(source)
                         sock.sendall(GET)
                         self.header = retrieve_header(GET, source, sock, 10*1024)
                    prev_size = len(data)
                    data += sock.recv(size - len(data))
               return data, sock
          self.header = retrieve_header(GET_message, source, source_socket, 10*1024)
          print "Retrieved", len(self.header), "bytes from the source", source

          print self.peer_connection_socket.getsockname(), "\b: waiting for the monitor peer ..."
          self.handle_peer_arrival(self.peer_connection_socket.accept())
          threading.Thread(target=self.handle_arrivals).start()
          threading.Thread(target=self.moderate_the_team).start()

          chunk_format_string = "H" + str(self.chunk_size) + "s" # "H1024s

          while self.alive:
               # Receive data from the source
               chunk, source_socket = receive_next_chunk(GET_message, source, source_socket, self.chunk_size)

               try:
                    self.peer_list[self.peer_index]
               except:
                    pass
               else:
                    peer = self.peer_list[self.peer_index]

               message = struct.pack(chunk_format_string, socket.htons(self.chunk_number), chunk)
               self.team_socket.sendto(message, peer)

               if __debug__:
                    print '%5d' % self.chunk_number, Color.red, '->', Color.none, peer
                    sys.stdout.flush()

               self.destination_of_chunk[self.chunk_number % self.buffer_size] = peer
               self.chunk_number = (self.chunk_number + 1) % 65536
               self.peer_index = (self.peer_index + 1) % len(self.peer_list)

               # Decrement (dividing by 2) the number of losses after
               # every 256 sent chunks.
               if (self.chunk_number % Splitter_DBS.losses_memory) == 0:
                    for i in self.losses:
                         self.losses[i] /= 2
                    '''
                    for i in self.complains:
                         self.complains[i] /= 2
                    '''




